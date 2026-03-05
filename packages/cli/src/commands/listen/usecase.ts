import type { MeetAiClient, Message } from "../../types";
import { ListenInput } from "./schema";
import { downloadMessageAttachments } from "../../lib/attachments";
import {
  appendToInbox,
  getTeamMembers,
  resolveInboxTargets,
  checkIdleAgents,
  IDLE_CHECK_INTERVAL_MS,
} from "../../inbox-router";
import { TmuxClient } from "../../lib/tmux-client";

function routeToInbox(
  msg: { sender: string; content: string },
  inboxDir: string,
  defaultInboxPath: string | null,
  teamDir: string,
  stdinPane?: string,
  attachmentPaths?: string[],
) {
  const entry: Record<string, unknown> = {
    from: `meet-ai:${msg.sender}`,
    text: msg.content,
    timestamp: new Date().toISOString(),
    read: false,
  };
  if (attachmentPaths?.length) {
    entry.attachments = attachmentPaths;
  }

  const members = getTeamMembers(teamDir);
  const targets = resolveInboxTargets(msg.content, members);

  if (targets) {
    for (const target of targets) {
      appendToInbox(`${inboxDir}/${target}.json`, entry as any);
    }
  } else if (stdinPane) {
    // Non-@mention message with stdinPane: stdout only (console.log already happened), skip inbox
  } else if (defaultInboxPath) {
    appendToInbox(defaultInboxPath, entry as any);
  }
}

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
          await client.sendTerminalData(roomId, JSON.stringify({ panes: results }));
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
        if (inboxDir && teamDir) routeToInbox(msg, inboxDir, defaultInboxPath, teamDir, stdinPane, paths);
      });
    } else {
      console.log(JSON.stringify(msg));
      if (inboxDir && teamDir) routeToInbox(msg, inboxDir, defaultInboxPath, teamDir, stdinPane);
    }
  };

  const ws = client.listen(roomId, { exclude, senderType, onMessage });

  // Idle agent heartbeat checker
  let idleCheckTimeout: ReturnType<typeof setTimeout> | null = null;
  const idleNotified = new Set<string>();

  if (inboxDir && inbox && teamDir) {
    function scheduleIdleCheck() {
      idleCheckTimeout = setTimeout(() => {
        const members = getTeamMembers(teamDir!);
        const newlyIdle = checkIdleAgents(inboxDir!, members, inbox!, idleNotified);
        for (const agent of newlyIdle) {
          idleNotified.add(agent);
          if (defaultInboxPath) {
            appendToInbox(defaultInboxPath, {
              from: "meet-ai:idle-check",
              text: `${agent} idle for 5+ minutes`,
              timestamp: new Date().toISOString(),
              read: false,
            });
          }
        }
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

  return ws;
}
