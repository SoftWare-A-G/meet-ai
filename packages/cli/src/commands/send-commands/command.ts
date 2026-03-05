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
    "project-path": {
      type: "string",
      description: "Path to the project (defaults to cwd)",
      required: false,
    },
  },
  async run({ args }) {
    try {
      const client = getClient();
      await sendCommands(client, {
        roomId: args.roomId,
        projectPath: args["project-path"] as string | undefined,
      });
    } catch (error) {
      err(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  },
});
