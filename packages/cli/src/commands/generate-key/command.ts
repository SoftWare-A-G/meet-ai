import { defineCommand } from "citty";
import { getClient } from "@meet-ai/cli/domain/bootstrap";
import { generateKey } from "./usecase";
import { err } from "@meet-ai/cli/lib/output";

export default defineCommand({
  meta: {
    name: "generate-key",
    description: "Generate a new API key",
  },
  args: {},
  async run() {
    try {
      const client = getClient();
      await generateKey(client);
    } catch (error) {
      err(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  },
});
