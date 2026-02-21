import { defineCommand } from "citty";
import { getClient } from "../../lib/client-factory";
import { createRoom } from "./usecase";
import { err } from "../../lib/output";

export default defineCommand({
  meta: {
    name: "create-room",
    description: "Create a new chat room",
  },
  args: {
    name: {
      type: "positional",
      description: "Name for the new room",
      required: true,
    },
  },
  async run({ args }) {
    try {
      const client = getClient();
      await createRoom(client, { name: args.name });
    } catch (error) {
      err(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  },
});
