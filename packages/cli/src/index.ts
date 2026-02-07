import { createClient } from "./client";

const API_URL = process.env.API_URL || "http://localhost:3000";
const client = createClient(API_URL);

const [command, ...args] = process.argv.slice(2);

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

  default:
    console.log("Commands: create-room, send-message");
}
