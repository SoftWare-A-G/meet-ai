import { defineCommand } from "citty";
import { getClient } from "../../lib/client-factory";
import { poll } from "./usecase";
import { err } from "../../lib/output";

export default defineCommand({
  meta: {
    name: "poll",
    description: "Poll for new messages",
  },
  args: {
    roomId: {
      type: "positional",
      description: "Room ID to poll messages from",
      required: true,
    },
    after: {
      type: "string",
      alias: "a",
      description: "Only messages after this ID",
    },
    exclude: {
      type: "string",
      alias: "e",
      description: "Exclude messages from this sender",
    },
    "sender-type": {
      type: "string",
      alias: "t",
      description: "Filter by sender type (human/agent)",
    },
  },
  async run({ args }) {
    try {
      const client = getClient();
      await poll(client, {
        roomId: args.roomId,
        after: args.after,
        exclude: args.exclude,
        senderType: args["sender-type"],
      });
    } catch (error) {
      err(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  },
});
