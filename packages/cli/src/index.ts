#!/usr/bin/env node
import { createClient, cleanupOldAttachments } from "./client";
import { appendToInbox, getTeamMembers, resolveInboxTargets, checkIdleAgents, IDLE_CHECK_INTERVAL_MS } from "./inbox-router";

const API_URL = process.env.MEET_AI_URL || "https://meet-ai.cc";
const API_KEY = process.env.MEET_AI_KEY;
const client = createClient(API_URL, API_KEY);

const [command, ...args] = process.argv.slice(2);

async function downloadMessageAttachments(roomId: string, messageId: string): Promise<string[]> {
  try {
    const attachments = await client.getMessageAttachments(roomId, messageId);
    if (!attachments.length) return [];
    const paths: string[] = [];
    for (const att of attachments) {
      try {
        const localPath = await client.downloadAttachment(att.id, att.filename);
        paths.push(localPath);
      } catch (error) {
        console.error(JSON.stringify({ event: "attachment_download_error", attachmentId: att.id, error: error instanceof Error ? error.message : String(error) }));
      }
    }
    return paths;
  } catch {
    return [];
  }
}

function parseFlags(args: string[]): { positional: string[]; flags: Record<string, string> } {
  const positional: string[] = [];
  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--") && i + 1 < args.length) {
      flags[args[i].slice(2)] = args[i + 1];
      i++;
    } else {
      positional.push(args[i]);
    }
  }
  return { positional, flags };
}

function rejectFlagLikeArgs(positional: string[], usage: string): void {
  for (const arg of positional) {
    if (arg.startsWith("--")) {
      console.error(`Unknown flag: ${arg}`);
      console.error(`Usage: ${usage}`);
      process.exit(1);
    }
  }
}

switch (command) {
  case "create-room": {
    // Check for --help flag early (before parseFlags)
    if (args.includes("--help")) {
      console.log("Usage: meet-ai create-room <room-name>");
      process.exit(0);
    }

    const { positional, flags } = parseFlags(args);

    // Check for unknown flags
    const unknownFlags = Object.keys(flags);
    if (unknownFlags.length > 0) {
      console.error(`Unknown flag: --${unknownFlags[0]}`);
      console.error("Usage: meet-ai create-room <room-name>");
      process.exit(1);
    }

    // Reject flag-like args
    rejectFlagLikeArgs(positional, "meet-ai create-room <room-name>");

    const name = positional[0];
    if (!name) {
      console.error("Usage: meet-ai create-room <room-name>");
      process.exit(1);
    }

    const room = await client.createRoom(name);
    console.log(`Room created: ${room.id} (${room.name})`);
    break;
  }

  case "delete-room": {
    // Check for --help flag
    if (args.includes("--help")) {
      console.log("Usage: meet-ai delete-room <roomId>");
      process.exit(0);
    }

    // Reject flag-like args
    rejectFlagLikeArgs(args, "meet-ai delete-room <roomId>");

    const roomId = args[0];
    if (!roomId) {
      console.error("Usage: meet-ai delete-room <roomId>");
      process.exit(1);
    }

    await client.deleteRoom(roomId);
    console.log(`Room deleted: ${roomId}`);
    break;
  }

  case "send-message": {
    // Check for --help flag
    if (args.includes("--help")) {
      console.log("Usage: meet-ai send-message <roomId> <sender> <content> [--color <color>]");
      process.exit(0);
    }

    const { positional: smPos, flags: smFlags } = parseFlags(args);

    // Reject flag-like args
    rejectFlagLikeArgs(smPos, "meet-ai send-message <roomId> <sender> <content> [--color <color>]");

    const [roomId, sender, ...rest] = smPos;
    const content = rest.join(" ").replace(/\\n/g, '\n');
    if (!roomId || !sender || !content) {
      console.error("Usage: meet-ai send-message <roomId> <sender> <content> [--color <color>]");
      process.exit(1);
    }
    const msg = await client.sendMessage(roomId, sender, content, smFlags.color);
    console.log(`Message sent: ${msg.id}`);
    break;
  }

  case "poll": {
    // Check for --help flag
    if (args.includes("--help")) {
      console.log("Usage: meet-ai poll <roomId> [--after <messageId>] [--exclude <sender>] [--sender-type <type>]");
      process.exit(0);
    }

    const { positional, flags } = parseFlags(args);

    // Reject flag-like args
    rejectFlagLikeArgs(positional, "meet-ai poll <roomId> [--after <messageId>] [--exclude <sender>] [--sender-type <type>]");

    const roomId = positional[0];
    if (!roomId) {
      console.error("Usage: meet-ai poll <roomId> [--after <messageId>] [--exclude <sender>] [--sender-type <type>]");
      process.exit(1);
    }
    const messages = await client.getMessages(roomId, {
      after: flags.after,
      exclude: flags.exclude,
      senderType: flags['sender-type'],
    });
    // Enrich messages with downloaded attachment paths
    const enriched = await Promise.all(messages.map(async (msg: any) => {
      const paths = await downloadMessageAttachments(roomId, msg.id);
      return paths.length ? { ...msg, attachments: paths } : msg;
    }));
    console.log(JSON.stringify(enriched));
    break;
  }

  case "listen": {
    // Check for --help flag
    if (args.includes("--help")) {
      console.log("Usage: meet-ai listen <roomId> [--exclude <sender>] [--sender-type <type>] [--team <name> --inbox <agent>]");
      process.exit(0);
    }

    const { positional, flags } = parseFlags(args);

    // Reject flag-like args
    rejectFlagLikeArgs(positional, "meet-ai listen <roomId> [--exclude <sender>] [--sender-type <type>] [--team <name> --inbox <agent>]");

    const roomId = positional[0];
    if (!roomId) {
      console.error("Usage: meet-ai listen <roomId> [--exclude <sender>] [--sender-type <type>] [--team <name> --inbox <agent>]");
      process.exit(1);
    }

    const team = flags.team;
    const inbox = flags.inbox;
    const inboxDir = team
      ? `${process.env.HOME}/.claude/teams/${team}/inboxes`
      : null;
    const defaultInboxPath = inboxDir && inbox
      ? `${inboxDir}/${inbox}.json`
      : null;

    const teamDir = team ? `${process.env.HOME}/.claude/teams/${team}` : null;

    function routeToInbox(msg: { sender: string; content: string }, attachmentPaths?: string[]) {
      if (!inboxDir) return;
      const entry: Record<string, unknown> = {
        from: `meet-ai:${msg.sender}`,
        text: msg.content,
        timestamp: new Date().toISOString(),
        read: false,
      };
      if (attachmentPaths?.length) {
        entry.attachments = attachmentPaths;
      }

      const members = teamDir ? getTeamMembers(teamDir) : new Set<string>();
      const targets = resolveInboxTargets(msg.content, members);

      if (targets) {
        for (const target of targets) {
          appendToInbox(`${inboxDir}/${target}.json`, entry as any);
        }
      } else if (defaultInboxPath) {
        appendToInbox(defaultInboxPath, entry as any);
      }
    }

    const onMessage = (msg: any) => {
      // Check for attachments asynchronously if broadcast indicates they exist
      if (msg.id && msg.room_id && msg.attachment_count > 0) {
        downloadMessageAttachments(msg.room_id, msg.id).then(paths => {
          const output = paths.length ? { ...msg, attachments: paths } : msg;
          console.log(JSON.stringify(output));
          if (inboxDir) routeToInbox(msg, paths);
        });
      } else {
        console.log(JSON.stringify(msg));
        if (inboxDir) routeToInbox(msg);
      }
    };

    const ws = client.listen(roomId, { exclude: flags.exclude, senderType: flags['sender-type'], onMessage });

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
        ws.close(1000, 'client shutdown');
      }
      process.exit(0);
    }
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    break;
  }

  case "send-log": {
    // Check for --help flag
    if (args.includes("--help")) {
      console.log("Usage: meet-ai send-log <roomId> <sender> <content> [--color <color>] [--message-id <id>]");
      process.exit(0);
    }

    const { positional: slPos, flags: slFlags } = parseFlags(args);

    // Reject flag-like args
    rejectFlagLikeArgs(slPos, "meet-ai send-log <roomId> <sender> <content> [--color <color>] [--message-id <id>]");

    const [slRoomId, slSender, ...slRest] = slPos;
    const slContent = slRest.join(" ").replace(/\\n/g, '\n');
    if (!slRoomId || !slSender || !slContent) {
      console.error("Usage: meet-ai send-log <roomId> <sender> <content> [--color <color>] [--message-id <id>]");
      process.exit(1);
    }
    const log = await client.sendLog(slRoomId, slSender, slContent, slFlags.color, slFlags['message-id']);
    console.log(`Log sent: ${log.id}`);
    break;
  }

  case "send-team-info": {
    // Check for --help flag
    if (args.includes("--help")) {
      console.log("Usage: meet-ai send-team-info <roomId> '<json-payload>'");
      process.exit(0);
    }

    // Reject flag-like args
    rejectFlagLikeArgs(args, "meet-ai send-team-info <roomId> '<json-payload>'");

    const [tiRoomId, tiPayload] = args;
    if (!tiRoomId || !tiPayload) {
      console.error("Usage: meet-ai send-team-info <roomId> '<json-payload>'");
      process.exit(1);
    }
    // Validate JSON before sending
    try {
      JSON.parse(tiPayload);
    } catch {
      console.error("Error: payload must be valid JSON");
      process.exit(1);
    }
    await client.sendTeamInfo(tiRoomId, tiPayload);
    console.log("Team info sent");
    break;
  }

  case "send-tasks": {
    // Check for --help flag
    if (args.includes("--help")) {
      console.log("Usage: meet-ai send-tasks <roomId> '<json-payload>'");
      process.exit(0);
    }

    // Reject flag-like args
    rejectFlagLikeArgs(args, "meet-ai send-tasks <roomId> '<json-payload>'");

    const [stRoomId, stPayload] = args;
    if (!stRoomId || !stPayload) {
      console.error("Usage: meet-ai send-tasks <roomId> '<json-payload>'");
      process.exit(1);
    }
    // Validate JSON before sending
    try {
      JSON.parse(stPayload);
    } catch {
      console.error("Error: payload must be valid JSON");
      process.exit(1);
    }
    await client.sendTasks(stRoomId, stPayload);
    console.log("Tasks info sent");
    break;
  }

  case "download-attachment": {
    // Check for --help flag
    if (args.includes("--help")) {
      console.log("Usage: meet-ai download-attachment <attachmentId>");
      process.exit(0);
    }

    // Reject flag-like args
    rejectFlagLikeArgs(args, "meet-ai download-attachment <attachmentId>");

    const attachmentId = args[0];
    if (!attachmentId) {
      console.error("Usage: meet-ai download-attachment <attachmentId>");
      process.exit(1);
    }
    try {
      // Clean up old files before downloading new ones
      cleanupOldAttachments();
      // Fetch attachment metadata to get the filename
      const res = await fetch(`${API_URL}/api/attachments/${attachmentId}`, {
        headers: API_KEY ? { "Authorization": `Bearer ${API_KEY}` } : undefined,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error((err as any).error ?? `HTTP ${res.status}`);
        process.exit(1);
      }
      const disposition = res.headers.get("Content-Disposition") || "";
      const filenameMatch = disposition.match(/filename="(.+?)"/);
      const filename = filenameMatch?.[1] || attachmentId;

      const { mkdirSync, writeFileSync } = await import("node:fs");
      const dir = "/tmp/meet-ai-attachments";
      mkdirSync(dir, { recursive: true });
      const localPath = `${dir}/${attachmentId}-${filename}`;
      const buffer = Buffer.from(await res.arrayBuffer());
      writeFileSync(localPath, buffer);
      console.log(localPath);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
    break;
  }

  case "generate-key": {
    const result = await client.generateKey();
    console.log(`API Key: ${result.key}`);
    console.log(`Prefix:  ${result.prefix}`);
    break;
  }

  default: {
    console.log(`meet-ai CLI

Environment variables:
  MEET_AI_URL   Server URL (default: https://meet-ai.cc)
  MEET_AI_KEY   API key for authentication

Commands:
  create-room <name>                           Create a new chat room
  delete-room <roomId>                         Delete a room and all its messages
  send-message <roomId> <sender> <content>     Send a message to a room
    --color <color>       Set sender name color (e.g. #ff0000, red)
  send-log <roomId> <sender> <content>        Send a log entry to a room
    --color <color>       Set sender name color (e.g. #ff0000, red)
    --message-id <id>     Associate log with a parent message
  poll <roomId> [options]                      Fetch messages from a room
    --after <id>          Only messages after this ID
    --exclude <sender>    Exclude messages from sender
    --sender-type <type>  Filter by sender_type (human|agent)
  listen <roomId> [options]                    Stream messages via WebSocket
    --exclude <sender>    Exclude messages from sender
    --sender-type <type>  Filter by sender_type (human|agent)
    --team <name>         Write to Claude Code team inbox
    --inbox <agent>       Target agent inbox (requires --team)
  download-attachment <attachmentId>             Download an attachment to /tmp
  send-team-info <roomId> '<json>'             Send team info to a room
  send-tasks <roomId> '<json>'                 Send tasks info to a room
  generate-key                                 Generate a new API key`);
  }
}
