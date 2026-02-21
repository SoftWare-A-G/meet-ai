import { defineCommand } from "citty";
import { getClient } from "../../lib/client-factory";
import { listen } from "./usecase";
import { err } from "../../lib/output";

export default defineCommand({
  meta: {
    name: "listen",
    description: "Stream messages via WebSocket",
  },
  args: {
    roomId: {
      type: "positional",
      description: "Room ID to listen on",
      required: true,
    },
    exclude: {
      type: "string",
      alias: "e",
      description: "Exclude messages from this sender",
    },
    "sender-type": {
      type: "string",
      alias: "t",
      description: "Filter by sender type (human|agent)",
    },
    team: {
      type: "string",
      alias: "T",
      description: "Team name for inbox routing",
    },
    inbox: {
      type: "string",
      alias: "i",
      description: "Inbox name for routing (requires --team)",
    },
  },
  run({ args }) {
    try {
      const client = getClient();
      // This is long-running — the WebSocket keeps the process alive until killed
      listen(client, {
        roomId: args.roomId,
        exclude: args.exclude,
        senderType: args["sender-type"],
        team: args.team,
        inbox: args.inbox,
      });
    } catch (error) {
      err(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  },
});
