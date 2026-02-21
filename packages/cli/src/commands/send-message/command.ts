import { defineCommand } from "citty";
import { getClient } from "../../lib/client-factory";
import { extractRestContent } from "../../lib/rest-content";
import { sendMessage } from "./usecase";
import { err } from "../../lib/output";

export default defineCommand({
  meta: {
    name: "send-message",
    description: "Send a message to a room",
  },
  args: {
    roomId: {
      type: "positional",
      description: "Room ID to send the message to",
      required: true,
    },
    sender: {
      type: "positional",
      description: "Sender name",
      required: true,
    },
    content: {
      type: "positional",
      description: "Message content",
      required: true,
    },
    color: {
      type: "string",
      alias: "c",
      description: "Sender color (hex)",
    },
  },
  async run({ args, rawArgs }) {
    try {
      // Join all positional args after roomId and sender into content
      // (rawArgs includes the subcommand args, skipCount=2 skips roomId + sender)
      const content = extractRestContent(rawArgs, 2);
      const client = getClient();
      await sendMessage(client, {
        roomId: args.roomId,
        sender: args.sender,
        content,
        color: args.color,
      });
    } catch (error) {
      err(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  },
});
