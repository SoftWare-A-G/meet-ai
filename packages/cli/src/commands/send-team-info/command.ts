import { defineCommand } from "citty";
import { getClient } from "../../lib/client-factory";
import { sendTeamInfo } from "./usecase";
import { err } from "../../lib/output";

export default defineCommand({
  meta: {
    name: "send-team-info",
    description: "Send team info to a room",
  },
  args: {
    roomId: {
      type: "positional",
      description: "Room ID to send team info to",
      required: true,
    },
    payload: {
      type: "positional",
      description: "JSON payload with team info",
      required: true,
    },
  },
  async run({ args }) {
    try {
      const client = getClient();
      await sendTeamInfo(client, { roomId: args.roomId, payload: args.payload });
    } catch (error) {
      err(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  },
});
