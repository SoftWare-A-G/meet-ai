import type { MeetAiClient, Message } from "@meet-ai/cli/types";
import type IInboxRouter from "@meet-ai/cli/domain/interfaces/IInboxRouter";
import { ListenInput } from "./schema";
import { downloadMessageAttachments } from "@meet-ai/cli/lib/attachments";
import { IDLE_CHECK_INTERVAL_MS } from "@meet-ai/cli/inbox-router";
import { TmuxClient } from "@meet-ai/cli/lib/tmux-client";

export function listen(
  client: MeetAiClient,
  input: {
    roomId: string;
    exclude?: string;
    senderType?: string;
    team?: string;
    inbox?: string;
    stdinPane?: string;
  },
  inboxRouter?: IInboxRouter,
): WebSocket {
  const parsed = ListenInput.parse(input);

  const { roomId, exclude, senderType, team, inbox, stdinPane } = parsed;

  const inboxDir = team
    ? `${process.env.HOME}/.claude/teams/${team}/inboxes`
    : null;
  const defaultInboxPath =
    inboxDir && inbox ? `${inboxDir}/${inbox}.json` : null;
  const teamDir = team
    ? `${process.env.HOME}/.claude/teams/${team}`
    : null;

  const tmuxClient = new TmuxClient({ server: "meet-ai", scrollback: 50000 });
  let terminalInterval: ReturnType<typeof setInterval> | null = null;

  const onMessage = (msg: Message & { room_id?: string; attachment_count?: number; type?: string; paneId?: string; cols?: number }) => {
    // Handle terminal resize — resize all room panes to match web viewer width
    if (msg.type === "terminal_resize") {
      const cols = msg.cols;
      if (typeof cols === "number" && cols > 0) {
        tmuxClient.listAllPanes().then(allPanes => {
          const roomPrefix = roomId.slice(0, 8);
          const roomPanes = allPanes.filter(p => p.sessionName.includes(roomPrefix));
          for (const p of roomPanes) {
            tmuxClient.resizePane(p.paneId, cols);
          }
        });
      }
      return;
    }

    // Handle terminal control messages
    if (msg.type === "terminal_subscribe") {
      const roomPrefix = roomId.slice(0, 8);

      // Read team config once for name mapping
      let membersByPaneId: Record<string, string> = {};
      if (teamDir) {
        try {
          const configPath = `${teamDir}/config.json`;
          const fs = require("node:fs") as typeof import("node:fs");
          const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
          const members = (config.members || []) as { name: string; tmuxPaneId?: string }[];
          for (const m of members) {
            if (m.tmuxPaneId) {
              membersByPaneId[m.tmuxPaneId] = m.name;
            }
          }
        } catch {
          // Continue without config — use tmux titles as names
        }
      }

      // Clear any previous stream
      if (terminalInterval) {
        clearInterval(terminalInterval);
        terminalInterval = null;
      }
      let lastSentPayload = "";
      const TERMINAL_POLL_MS = 500;
      terminalInterval = setInterval(async () => {
        try {
          // Re-discover live panes each tick so removed panes disappear from UI
          const allTmuxPanes = await tmuxClient.listAllPanes();
          const roomPanes = allTmuxPanes.filter(p => p.sessionName.includes(roomPrefix));

          if (roomPanes.length === 0) return;

          const panes = roomPanes.map(tp => ({
            name: membersByPaneId[tp.paneId] || tp.title || tp.paneId,
            paneId: tp.paneId,
          }));

          // Sort: team-lead first, then alphabetical
          panes.sort((a, b) => {
            if (a.name === "team-lead") return -1;
            if (b.name === "team-lead") return 1;
            return a.name.localeCompare(b.name);
          });

          const results = await Promise.all(
            panes.map(async (p) => {
              const lines = await tmuxClient.capturePane(p.paneId, 0);
              return { name: p.name, paneId: p.paneId, data: lines.join("\r\n") };
            })
          );
          const payload = JSON.stringify({ panes: results });
          // Skip sending if nothing changed since last tick
          if (payload === lastSentPayload) return;
          lastSentPayload = payload;
          await client.sendTerminalData(roomId, payload);
        } catch {
          // Gracefully handle errors
        }
      }, TERMINAL_POLL_MS);
      return;
    }

    if (msg.type === "terminal_unsubscribe") {
      if (terminalInterval) {
        clearInterval(terminalInterval);
        terminalInterval = null;
      }
      return;
    }

    // Ignore terminal_data echoes (our own broadcasts reflected back)
    if (msg.type === "terminal_data") {
      return;
    }

    // Check for attachments asynchronously if broadcast indicates they exist
    if (msg.id && msg.room_id && (msg as any).attachment_count > 0) {
      downloadMessageAttachments(client, msg.room_id, msg.id).then((paths) => {
        const output = paths.length ? { ...msg, attachments: paths } : msg;
        console.log(JSON.stringify(output));
        if (inboxDir && teamDir && inboxRouter) inboxRouter.route(msg, { inboxDir, defaultInboxPath, teamDir, stdinPane, attachmentPaths: paths });
      });
    } else {
      console.log(JSON.stringify(msg));
      if (inboxDir && teamDir && inboxRouter) inboxRouter.route(msg, { inboxDir, defaultInboxPath, teamDir, stdinPane });
    }
  };

  const ws = client.listen(roomId, { exclude, senderType, onMessage });

  // Idle agent heartbeat checker
  let idleCheckTimeout: ReturnType<typeof setTimeout> | null = null;
  const idleNotified = new Set<string>();

  if (inboxDir && inbox && teamDir && inboxRouter) {
    function scheduleIdleCheck() {
      idleCheckTimeout = setTimeout(() => {
        inboxRouter!.checkIdle({ inboxDir: inboxDir!, teamDir: teamDir!, inbox: inbox!, defaultInboxPath, notified: idleNotified });
        scheduleIdleCheck();
      }, IDLE_CHECK_INTERVAL_MS);
    }
    scheduleIdleCheck();
  }

  // Graceful shutdown: send clean close frame before exit
  function shutdown() {
    if (idleCheckTimeout) clearTimeout(idleCheckTimeout);
    if (terminalInterval) {
      clearInterval(terminalInterval);
      terminalInterval = null;
    }
    if (ws.readyState === WebSocket.OPEN) {
      ws.close(1000, "client shutdown");
    }
    process.exit(0);
  }
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  process.on("SIGHUP", shutdown);

  return ws;
}
