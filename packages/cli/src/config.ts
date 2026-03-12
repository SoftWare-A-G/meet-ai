/**
 * Settings loader for meet-ai configuration.
 * Reads credentials from ~/.meet-ai/config.json (single source of truth).
 * Legacy sources (env vars, Claude/Codex settings) are only used by findMigratableConfigSources().
 */

import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { z } from "zod";
import { getCodexConfigPaths, readCodexConfigEnv } from "@meet-ai/cli/lib/codex";
import { getHomeCredentials, setMeetAiDirOverride } from "@meet-ai/cli/lib/meetai-home";

interface ClaudeSettings {
  env?: Record<string, string>;
  [key: string]: unknown;
}

export const configSchema = z.object({
  url: z.string().url("MEET_AI_URL must be a valid URL"),
  key: z.string().optional(),
});

export type MeetAiConfig = z.infer<typeof configSchema>;
export type ExternalConfigSourceKind = "project-claude" | "user-claude" | "codex";

export interface MigratableConfigSource {
  kind: ExternalConfigSourceKind;
  label: string;
  path: string;
  url: string;
  key: string;
  envName: string;
}

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

function deriveEnvNameFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/\./g, "-");
  } catch {
    return "default";
  }
}

function toMigratableConfigSource(
  kind: ExternalConfigSourceKind,
  label: string,
  path: string,
  values: { url?: string; key?: string } | null,
): MigratableConfigSource | null {
  if (!values?.url || !values.key) return null;

  const parsed = configSchema.safeParse({ url: values.url, key: values.key });
  if (!parsed.success || !parsed.data.key) return null;

  return {
    kind,
    label,
    path,
    url: parsed.data.url,
    key: parsed.data.key,
    envName: deriveEnvNameFromUrl(parsed.data.url),
  };
}

interface ResolveOptions {
  /** Override project-level settings path (for testing). */
  projectSettingsPath?: string;
  /** Override user home directory (for testing). */
  homeDir?: string;
  /** Override Codex home directory (for testing). */
  codexHome?: string;
  /** Override ~/.meet-ai home directory (for testing). */
  meetaiHome?: string;
}

/**
 * Resolve raw config values from ~/.meet-ai/config.json (single source of truth).
 */
export function resolveRawConfig(
  opts?: ResolveOptions,
): { url: string; key: string | undefined } {
  if (opts?.meetaiHome) setMeetAiDirOverride(opts.meetaiHome);
  try {
    const creds = getHomeCredentials();
    if (creds) return creds;
  } finally {
    if (opts?.meetaiHome) setMeetAiDirOverride(undefined);
  }

  return { url: "https://meet-ai.cc", key: undefined };
}

/**
 * Get meet-ai configuration from ~/.meet-ai/config.json, validated with zod.
 */
export function getMeetAiConfig(opts?: ResolveOptions): MeetAiConfig {
  const raw = resolveRawConfig(opts);
  const config = configSchema.parse(raw);

  if (!config.key) {
    throw new Error("No meet-ai credentials found. Run 'meet-ai' to set up.");
  }

  return config;
}

export function findMigratableConfigSources(
  opts?: ResolveOptions,
): MigratableConfigSource[] {
  const results: MigratableConfigSource[] = [];

  const projectSettingsPath = opts?.projectSettingsPath ??
    resolve("./.claude/settings.json");
  const projectSettings = loadSettingsFromPath(projectSettingsPath);
  const projectSource = toMigratableConfigSource(
    "project-claude",
    "Project Claude settings",
    projectSettingsPath,
    {
      url: projectSettings?.env?.MEET_AI_URL,
      key: projectSettings?.env?.MEET_AI_KEY,
    },
  );
  if (projectSource) results.push(projectSource);

  const userSettingsPath = join(
    opts?.homeDir ?? homedir(),
    ".claude/settings.json",
  );
  const userSettings = loadSettingsFromPath(userSettingsPath);
  const userSource = toMigratableConfigSource(
    "user-claude",
    "User Claude settings",
    userSettingsPath,
    {
      url: userSettings?.env?.MEET_AI_URL,
      key: userSettings?.env?.MEET_AI_KEY,
    },
  );
  if (userSource) results.push(userSource);

  const codexEnv = readCodexConfigEnv({ codexHome: opts?.codexHome });
  if (codexEnv?.MEET_AI_URL && codexEnv?.MEET_AI_KEY) {
    for (const path of getCodexConfigPaths({ codexHome: opts?.codexHome })) {
      const source = toMigratableConfigSource(
        "codex",
        "Codex config",
        path,
        {
          url: codexEnv.MEET_AI_URL,
          key: codexEnv.MEET_AI_KEY,
        },
      );
      if (source) {
        results.push(source);
        break;
      }
    }
  }

  return results;
}
