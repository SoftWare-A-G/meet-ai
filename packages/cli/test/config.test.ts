import { test, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { z } from "zod";
import {
  getMeetAiConfig,
  resolveRawConfig,
  configSchema,
} from "../src/config";

// Save original env vars so we can restore them
let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  savedEnv = {
    MEET_AI_URL: process.env.MEET_AI_URL,
    MEET_AI_KEY: process.env.MEET_AI_KEY,
  };
});

afterEach(() => {
  // Restore original env
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

// --- Config priority chain ---

test("env vars override file settings", () => {
  // GIVEN: MEET_AI_URL and MEET_AI_KEY are set in process.env
  process.env.MEET_AI_URL = "https://env-override.example.com";
  process.env.MEET_AI_KEY = "mai_env_key_123";

  // WHEN: config is resolved
  const config = getMeetAiConfig();

  // THEN: env var values take priority
  expect(config.url).toBe("https://env-override.example.com");
  expect(config.key).toBe("mai_env_key_123");
});

test("resolveRawConfig returns env vars when set", () => {
  // GIVEN: env vars are set
  process.env.MEET_AI_URL = "https://raw-env.example.com";
  process.env.MEET_AI_KEY = "mai_raw_123";

  // WHEN: raw config is resolved
  const raw = resolveRawConfig();

  // THEN: env var values are returned
  expect(raw.url).toBe("https://raw-env.example.com");
  expect(raw.key).toBe("mai_raw_123");
});

// --- Default values ---

test("defaults to https://meet-ai.cc when no config sources exist", () => {
  // GIVEN: no env vars are set
  delete process.env.MEET_AI_URL;
  delete process.env.MEET_AI_KEY;

  // WHEN: raw config is resolved (avoids file-system dependency)
  const raw = resolveRawConfig();

  // THEN: defaults are returned
  expect(raw.url).toBe("https://meet-ai.cc");
  expect(raw.key).toBeUndefined();
});

test("default config passes validation", () => {
  // GIVEN: no env vars are set
  delete process.env.MEET_AI_URL;
  delete process.env.MEET_AI_KEY;

  // WHEN: getMeetAiConfig is called
  const config = getMeetAiConfig();

  // THEN: the default URL passes schema validation
  expect(config.url).toBe("https://meet-ai.cc");
  expect(config.key).toBeUndefined();
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

test("getMeetAiConfig throws on invalid URL from env", () => {
  // GIVEN: an invalid URL in env vars
  process.env.MEET_AI_URL = "not-a-url";

  // WHEN/THEN: getMeetAiConfig throws a ZodError
  expect(() => getMeetAiConfig()).toThrow(z.ZodError);
});

test("localhost URL passes validation", () => {
  // GIVEN: a localhost URL
  process.env.MEET_AI_URL = "http://localhost:8787";
  process.env.MEET_AI_KEY = "mai_local";

  // WHEN: config is loaded
  const config = getMeetAiConfig();

  // THEN: localhost URL is accepted
  expect(config.url).toBe("http://localhost:8787");
});

// --- Key prefix warning ---

test("warns when key does not start with mai_ prefix", () => {
  // GIVEN: a key without the mai_ prefix
  process.env.MEET_AI_URL = "https://meet-ai.cc";
  process.env.MEET_AI_KEY = "bad_prefix_key";
  const warnSpy = spyOn(console, "warn").mockImplementation(() => {});

  // WHEN: config is loaded
  getMeetAiConfig();

  // THEN: a warning is logged
  expect(warnSpy).toHaveBeenCalledTimes(1);
  expect(warnSpy.mock.calls[0][0]).toContain("does not start with 'mai_'");

  warnSpy.mockRestore();
});

test("does not warn when key starts with mai_ prefix", () => {
  // GIVEN: a properly prefixed key
  process.env.MEET_AI_URL = "https://meet-ai.cc";
  process.env.MEET_AI_KEY = "mai_valid_key_123";
  const warnSpy = spyOn(console, "warn").mockImplementation(() => {});

  // WHEN: config is loaded
  getMeetAiConfig();

  // THEN: no warning is logged
  expect(warnSpy).not.toHaveBeenCalled();

  warnSpy.mockRestore();
});

test("does not warn when key is undefined", () => {
  // GIVEN: no key is set
  process.env.MEET_AI_URL = "https://meet-ai.cc";
  delete process.env.MEET_AI_KEY;
  const warnSpy = spyOn(console, "warn").mockImplementation(() => {});

  // WHEN: config is loaded
  getMeetAiConfig();

  // THEN: no warning is logged
  expect(warnSpy).not.toHaveBeenCalled();

  warnSpy.mockRestore();
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
