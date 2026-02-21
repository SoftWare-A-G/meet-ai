/**
 * Settings loader for Claude Code integration
 * Reads MEET_AI_* env vars from:
 * 1. process.env (highest priority)
 * 2. ./.claude/settings.json (project-level)
 * 3. ~/.claude/settings.json (user-level)
 */

import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { z } from "zod";

interface ClaudeSettings {
  env?: Record<string, string>;
  [key: string]: unknown;
}

export const configSchema = z.object({
  url: z.string().url("MEET_AI_URL must be a valid URL"),
  key: z.string().optional(),
});

export type MeetAiConfig = z.infer<typeof configSchema>;

/**
 * Load settings from a specific path
 */
function loadSettingsFromPath(path: string): ClaudeSettings | null {
  try {
    if (!existsSync(path)) {
      return null;
    }
    const content = readFileSync(path, "utf-8");
    return JSON.parse(content) as ClaudeSettings;
  } catch {
    return null;
  }
}

/**
 * Resolve raw config values from all sources (before validation).
 * Priority: process.env > project settings > user settings > defaults
 */
export function resolveRawConfig(): { url: string; key: string | undefined } {
  // Highest priority: process.env
  if (process.env.MEET_AI_URL) {
    return {
      url: process.env.MEET_AI_URL,
      key: process.env.MEET_AI_KEY,
    };
  }

  // Next: project-level settings (.claude/settings.json in current directory)
  const projectSettingsPath = resolve("./.claude/settings.json");
  const projectSettings = loadSettingsFromPath(projectSettingsPath);

  if (projectSettings?.env?.MEET_AI_URL) {
    return {
      url: projectSettings.env.MEET_AI_URL,
      key: projectSettings.env.MEET_AI_KEY,
    };
  }

  // Next: user-level settings (~/.claude/settings.json)
  const userSettingsPath = join(homedir(), ".claude/settings.json");
  const userSettings = loadSettingsFromPath(userSettingsPath);

  if (userSettings?.env?.MEET_AI_URL) {
    return {
      url: userSettings.env.MEET_AI_URL,
      key: userSettings.env.MEET_AI_KEY,
    };
  }

  // Default fallback
  return {
    url: "https://meet-ai.cc",
    key: undefined,
  };
}

/**
 * Get meet-ai configuration from all sources, validated with zod.
 * Priority: process.env > project settings > user settings > defaults
 */
export function getMeetAiConfig(): MeetAiConfig {
  const raw = resolveRawConfig();
  const config = configSchema.parse(raw);

  if (config.key && !config.key.startsWith("mai_")) {
    console.warn(
      "Warning: MEET_AI_KEY does not start with 'mai_' — this may not be a valid key",
    );
  }

  return config;
}
