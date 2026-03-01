import React from "react";
import { render } from "ink";
import { App } from "../../tui/app";
import { ProcessManager } from "../../lib/process-manager";
import { findClaudeCli } from "../../spawner";
import type { MeetAiClient } from "../../types";
import type { MeetAiConfig } from "../../config";

export function startDashboard(
  client: MeetAiClient,
  config: MeetAiConfig,
): void {
  const claudePath = findClaudeCli();

  const processManager = new ProcessManager({
    claudePath,
    env: {
      ...(config.url ? { MEET_AI_URL: config.url } : {}),
      ...(config.key ? { MEET_AI_KEY: config.key } : {}),
    },
  });

  // Cleanup on exit
  function cleanup() {
    processManager.killAll();
    process.exit(0);
  }
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  const element = React.createElement(App, { processManager, client });
  render(element);
}
