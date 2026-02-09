import { createClient } from "./client";
import { appendToInbox, getTeamMembers, resolveInboxTargets, checkIdleAgents, IDLE_CHECK_INTERVAL_MS } from "./inbox-router";

const API_URL = process.env.MEET_AI_URL || "http://localhost:8787";
const API_KEY = process.env.MEET_AI_KEY;
const client = createClient(API_URL, API_KEY);

const [command, ...args] = process.argv.slice(2);

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

switch (command) {
  case "create-room": {
    const name = args[0];
    if (!name) {
      console.error("Usage: cli create-room <name>");
      process.exit(1);
    }
    const room = await client.createRoom(name);
    console.log(`Room created: ${room.id} (${room.name})`);
    break;
  }

  case "send-message": {
    const { positional: smPos, flags: smFlags } = parseFlags(args);
    const [roomId, sender, ...rest] = smPos;
    const content = rest.join(" ");
    if (!roomId || !sender || !content) {
      console.error("Usage: cli send-message <roomId> <sender> <content> [--color <color>]");
      process.exit(1);
    }
    const msg = await client.sendMessage(roomId, sender, content, smFlags.color);
    console.log(`Message sent: ${msg.id}`);
    break;
  }

  case "poll": {
    const { positional, flags } = parseFlags(args);
    const roomId = positional[0];
    if (!roomId) {
      console.error("Usage: cli poll <roomId> [--after <messageId>] [--exclude <sender>]");
      process.exit(1);
    }
    const messages = await client.getMessages(roomId, {
      after: flags.after,
      exclude: flags.exclude,
      senderType: flags['sender-type'],
    });
    console.log(JSON.stringify(messages));
    break;
  }

  case "listen": {
    const { positional, flags } = parseFlags(args);
    const roomId = positional[0];
    if (!roomId) {
      console.error("Usage: cli listen <roomId> [--exclude <sender>] [--sender-type <type>] [--team <name> --inbox <agent>]");
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

    function routeToInbox(msg: { sender: string; content: string }) {
      if (!inboxDir) return;
      const entry = {
        from: "meet-ai:" + msg.sender,
        text: msg.content,
        timestamp: new Date().toISOString(),
        read: false,
      };

      const members = teamDir ? getTeamMembers(teamDir) : new Set<string>();
      const targets = resolveInboxTargets(msg.content, members);

      if (targets) {
        for (const target of targets) {
          appendToInbox(`${inboxDir}/${target}.json`, entry);
        }
      } else if (defaultInboxPath) {
        appendToInbox(defaultInboxPath, entry);
      }
    }

    const onMessage = inboxDir
      ? (msg: any) => {
          console.log(JSON.stringify(msg));
          routeToInbox(msg);
        }
      : undefined;

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

  case "generate-key": {
    const result = await client.generateKey();
    console.log(`API Key: ${result.key}`);
    console.log(`Prefix:  ${result.prefix}`);
    break;
  }

  default:
    console.log(`meet-ai CLI

Environment variables:
  MEET_AI_URL   Server URL (default: http://localhost:8787)
  MEET_AI_KEY   API key for authentication (optional for local, required for production)

Commands:
  create-room <name>                           Create a new chat room
  send-message <roomId> <sender> <content>     Send a message to a room
    --color <color>       Set sender name color (e.g. #ff0000, red)
  poll <roomId> [options]                      Fetch messages from a room
    --after <id>          Only messages after this ID
    --exclude <sender>    Exclude messages from sender
    --sender-type <type>  Filter by sender_type (human|agent)
  listen <roomId> [options]                    Stream messages via WebSocket
    --exclude <sender>    Exclude messages from sender
    --sender-type <type>  Filter by sender_type (human|agent)
    --team <name>         Write to Claude Code team inbox
    --inbox <agent>       Target agent inbox (requires --team)
  generate-key                                 Generate a new API key`);
}
