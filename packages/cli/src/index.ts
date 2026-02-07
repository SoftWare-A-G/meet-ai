import { createClient } from "./client";

const API_URL = process.env.MEET_AI_URL || "http://localhost:3000";
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
    const [roomId, sender, ...rest] = args;
    const content = rest.join(" ");
    if (!roomId || !sender || !content) {
      console.error("Usage: cli send-message <roomId> <sender> <content>");
      process.exit(1);
    }
    const msg = await client.sendMessage(roomId, sender, content);
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
    });
    console.log(JSON.stringify(messages));
    break;
  }

  case "listen": {
    const { positional, flags } = parseFlags(args);
    const roomId = positional[0];
    if (!roomId) {
      console.error("Usage: cli listen <roomId> [--exclude <sender>]");
      process.exit(1);
    }
    client.listen(roomId, { exclude: flags.exclude });
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
  MEET_AI_URL   Server URL (default: http://localhost:3000)
  MEET_AI_KEY   API key for authentication (optional for local, required for production)

Commands:
  create-room <name>                           Create a new chat room
  send-message <roomId> <sender> <content>     Send a message to a room
  poll <roomId> [--after <id>] [--exclude <s>] Fetch messages from a room
  listen <roomId> [--exclude <sender>]         Stream messages via WebSocket
  generate-key                                 Generate a new API key`);
}
