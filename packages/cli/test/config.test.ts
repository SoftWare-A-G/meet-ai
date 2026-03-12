import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import {
  findMigratableConfigSources,
  getMeetAiConfig,
  resolveRawConfig,
  configSchema,
} from "@meet-ai/cli/config";
import { setMeetAiDirOverride, writeHomeConfig } from "@meet-ai/cli/lib/meetai-home";

const TEMP_MEET_AI_DIR = '/tmp/meet-ai-config-test-home';

beforeEach(() => {
  rmSync(TEMP_MEET_AI_DIR, { recursive: true, force: true });
});

afterEach(() => {
  setMeetAiDirOverride(undefined);
  rmSync(TEMP_MEET_AI_DIR, { recursive: true, force: true });
});

// Helper: write a home config with test credentials
function writeTestHomeConfig(url: string, key: string) {
  setMeetAiDirOverride(TEMP_MEET_AI_DIR);
  writeHomeConfig({
    defaultEnv: 'default',
    envs: { default: { url, key } },
  });
}

// --- Home config resolution ---

test("resolveRawConfig returns credentials from home config", () => {
  // GIVEN: a home config with url and key
  writeTestHomeConfig('https://home-config.example.com', 'mai_home_123');

  // WHEN: raw config is resolved
  const raw = resolveRawConfig();

  // THEN: home config values are returned
  expect(raw.url).toBe('https://home-config.example.com');
  expect(raw.key).toBe('mai_home_123');
});

test("resolveRawConfig accepts meetaiHome option", () => {
  // GIVEN: a home config at a custom path
  mkdirSync(TEMP_MEET_AI_DIR, { recursive: true });
  writeFileSync(
    `${TEMP_MEET_AI_DIR}/config.json`,
    JSON.stringify({
      $schema: 'https://meet-ai.cc/schemas/config.json',
      defaultEnv: 'default',
      envs: { default: { url: 'https://custom-path.example.com', key: 'mai_custom_123' } },
    }),
  );

  // WHEN: resolveRawConfig is called with meetaiHome
  const raw = resolveRawConfig({ meetaiHome: TEMP_MEET_AI_DIR });

  // THEN: values from the custom path are returned
  expect(raw.url).toBe('https://custom-path.example.com');
  expect(raw.key).toBe('mai_custom_123');
});

// --- Default values ---

test("defaults to https://meet-ai.cc when no home config exists", () => {
  // GIVEN: no home config file
  setMeetAiDirOverride('/tmp/nonexistent-meet-ai-dir');

  // WHEN: raw config is resolved
  const raw = resolveRawConfig();

  // THEN: defaults are returned
  expect(raw.url).toBe("https://meet-ai.cc");
  expect(raw.key).toBeUndefined();
});

test("getMeetAiConfig throws when no home config exists", () => {
  // GIVEN: no home config file (key will be undefined)
  setMeetAiDirOverride('/tmp/nonexistent-meet-ai-dir');

  // WHEN/THEN: getMeetAiConfig throws with the setup error
  expect(() => getMeetAiConfig()).toThrow(
    "No meet-ai credentials found. Run 'meet-ai' to set up."
  );
});

test("localhost URL passes validation via home config", () => {
  // GIVEN: a home config with localhost URL
  writeTestHomeConfig('http://localhost:8787', 'mai_local_key');

  // WHEN: config is loaded
  const config = getMeetAiConfig();

  // THEN: localhost URL is accepted
  expect(config.url).toBe("http://localhost:8787");
});

// --- findMigratableConfigSources ---

test("findMigratableConfigSources discovers project, user, and codex sources", () => {
  process.env.MEET_AI_RUNTIME = "codex";

  const codexHome = "/tmp/meet-ai-migrate-codex";
  const projectRoot = "/tmp/meet-ai-migrate-project";
  const userHome = "/tmp/meet-ai-migrate-user";
  rmSync(codexHome, { recursive: true, force: true });
  rmSync(projectRoot, { recursive: true, force: true });
  rmSync(userHome, { recursive: true, force: true });
  mkdirSync(codexHome, { recursive: true });
  mkdirSync(`${projectRoot}/.claude`, { recursive: true });
  mkdirSync(`${userHome}/.claude`, { recursive: true });

  writeFileSync(
    `${codexHome}/config.toml`,
    ['[env]', 'MEET_AI_URL = "https://codex-config.example.com"', 'MEET_AI_KEY = "mai_codex_123"', ""].join("\n"),
  );
  const projectSettingsPath = `${projectRoot}/.claude/settings.json`;
  writeFileSync(
    projectSettingsPath,
    JSON.stringify({
      env: {
        MEET_AI_URL: "https://project-settings.example.com",
        MEET_AI_KEY: "mai_project_123",
      },
    }),
  );
  writeFileSync(
    `${userHome}/.claude/settings.json`,
    JSON.stringify({
      env: {
        MEET_AI_URL: "https://user-settings.example.com",
        MEET_AI_KEY: "mai_user_123",
      },
    }),
  );

  const sources = findMigratableConfigSources({
    codexHome,
    homeDir: userHome,
    projectSettingsPath,
  });

  expect(sources).toHaveLength(3);
  expect(sources.map(source => source.kind)).toEqual([
    "project-claude",
    "user-claude",
    "codex",
  ]);
  expect(sources.map(source => source.envName)).toEqual([
    "project-settings-example-com",
    "user-settings-example-com",
    "codex-config-example-com",
  ]);
});

// --- URL validation ---

test("valid URL passes schema validation", () => {
  // GIVEN: a valid URL
  const result = configSchema.safeParse({
    url: "https://example.com",
    key: "mai_abc",
  });

  // THEN: parsing succeeds
  expect(result.success).toBe(true);
});

test("invalid URL fails schema validation", () => {
  // GIVEN: an invalid URL
  const result = configSchema.safeParse({
    url: "not-a-url",
    key: "mai_abc",
  });

  // THEN: parsing fails with URL error
  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error.issues[0].message).toBe(
      "MEET_AI_URL must be a valid URL",
    );
  }
});

// --- Schema shape ---

test("configSchema allows optional key", () => {
  // GIVEN: config with no key
  const result = configSchema.safeParse({ url: "https://meet-ai.cc" });

  // THEN: parsing succeeds, key is undefined
  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.data.key).toBeUndefined();
  }
});
