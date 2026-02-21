#!/usr/bin/env node
import { defineCommand, runMain } from "citty";
import { spawnInteractive } from "./spawner.js";
import { err } from "./lib/output.js";

const main = defineCommand({
  meta: {
    name: "meet-ai",
    version: "0.0.13",
    description:
      "CLI for meet-ai chat rooms — create rooms, send messages, and stream via WebSocket",
  },
  subCommands: {
    "create-room": () =>
      import("./commands/create-room/command").then((m) => m.default),
    "delete-room": () =>
      import("./commands/delete-room/command").then((m) => m.default),
    "send-message": () =>
      import("./commands/send-message/command").then((m) => m.default),
    "send-log": () =>
      import("./commands/send-log/command").then((m) => m.default),
    poll: () => import("./commands/poll/command").then((m) => m.default),
    listen: () => import("./commands/listen/command").then((m) => m.default),
    "send-team-info": () =>
      import("./commands/send-team-info/command").then((m) => m.default),
    "send-tasks": () =>
      import("./commands/send-tasks/command").then((m) => m.default),
    "download-attachment": () =>
      import("./commands/download-attachment/command").then((m) => m.default),
    "generate-key": () =>
      import("./commands/generate-key/command").then((m) => m.default),
  },
  async run() {
    // Only spawn interactive mode when no subcommand was given
    const hasSubcommand = process.argv.length > 2;
    if (hasSubcommand) return;

    try {
      await spawnInteractive();
    } catch (error) {
      err(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  },
});

runMain(main);
