import { defineCommand } from "citty";
import { getClient } from "../../lib/client-factory";
import { sendCommands } from "./usecase";
import { err } from "../../lib/output";

export default defineCommand({
  meta: {
    name: "send-commands",
    description: "Send commands list to a room",
  },
  args: {
    roomId: {
      type: "positional",
      description: "Room ID to send commands to",
      required: true,
    },
    payload: {
      type: "positional",
      description: "JSON commands payload",
      required: false,
    },
  },
  async run({ args }) {
    try {
      const client = getClient();
      let payload = args.payload as string | undefined;

      if (!payload) {
        // Read from stdin
        const chunks: Buffer[] = [];
        for await (const chunk of process.stdin) {
          chunks.push(chunk);
        }
        payload = Buffer.concat(chunks).toString("utf8").trim();
      }

      await sendCommands(client, { roomId: args.roomId, payload });
    } catch (error) {
      err(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  },
});
