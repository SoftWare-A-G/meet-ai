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

function routeToInbox(
  msg: { sender: string; content: string },
  inboxDir: string,
  defaultInboxPath: string | null,
  teamDir: string,
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
  },
): WebSocket {
  const parsed = ListenInput.parse(input);

  const { roomId, exclude, senderType, team, inbox } = parsed;

  const inboxDir = team
    ? `${process.env.HOME}/.claude/teams/${team}/inboxes`
    : null;
  const defaultInboxPath =
    inboxDir && inbox ? `${inboxDir}/${inbox}.json` : null;
  const teamDir = team
    ? `${process.env.HOME}/.claude/teams/${team}`
    : null;

  const onMessage = (msg: Message & { room_id?: string; attachment_count?: number }) => {
    // Check for attachments asynchronously if broadcast indicates they exist
    if (msg.id && msg.room_id && (msg as any).attachment_count > 0) {
      downloadMessageAttachments(client, msg.room_id, msg.id).then((paths) => {
        const output = paths.length ? { ...msg, attachments: paths } : msg;
        console.log(JSON.stringify(output));
        if (inboxDir && teamDir) routeToInbox(msg, inboxDir, defaultInboxPath, teamDir, paths);
      });
    } else {
      console.log(JSON.stringify(msg));
      if (inboxDir && teamDir) routeToInbox(msg, inboxDir, defaultInboxPath, teamDir);
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
    if (ws.readyState === WebSocket.OPEN) {
      ws.close(1000, "client shutdown");
    }
    process.exit(0);
  }
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  return ws;
}
