import { defineCommand } from "citty";
import { getClient } from "../../lib/client-factory";
import { getMeetAiConfig } from "../../config";
import { startDashboard } from "./usecase";
import { err } from "../../lib/output";

export default defineCommand({
  meta: {
    name: "dashboard",
    description: "TUI dashboard for spawning and viewing agent teams",
  },
  args: {
    debug: {
      type: "boolean",
      description: "Show debug output in panes (spawn commands, raw chunks, exit codes)",
      default: false,
    },
  },
  run({ args }) {
    try {
      const client = getClient();
      const config = getMeetAiConfig();
      startDashboard(client, config, { debug: args.debug });
    } catch (error) {
      err(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  },
});
