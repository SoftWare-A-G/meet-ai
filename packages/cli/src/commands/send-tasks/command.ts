import { defineCommand } from "citty";
import { getClient } from "../../lib/client-factory";
import { sendTasks } from "./usecase";
import { err } from "../../lib/output";

export default defineCommand({
  meta: {
    name: "send-tasks",
    description: "Send task list to a room",
  },
  args: {
    roomId: {
      type: "positional",
      description: "Room ID to send tasks to",
      required: true,
    },
    payload: {
      type: "positional",
      description: "JSON payload with task data",
      required: true,
    },
  },
  async run({ args }) {
    try {
      const client = getClient();
      await sendTasks(client, { roomId: args.roomId, payload: args.payload });
    } catch (error) {
      err(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  },
});
