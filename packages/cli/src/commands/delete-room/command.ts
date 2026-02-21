import { defineCommand } from "citty";
import { getClient } from "../../lib/client-factory";
import { deleteRoom } from "./usecase";
import { err } from "../../lib/output";

export default defineCommand({
  meta: {
    name: "delete-room",
    description: "Delete a chat room",
  },
  args: {
    roomId: {
      type: "positional",
      description: "ID of the room to delete",
      required: true,
    },
  },
  async run({ args }) {
    try {
      await deleteRoom(getClient(), { roomId: args.roomId });
    } catch (error) {
      err(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  },
});
