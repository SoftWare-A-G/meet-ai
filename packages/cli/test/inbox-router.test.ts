import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { appendToInbox, getTeamMembers, resolveInboxTargets, checkIdleAgents, IDLE_THRESHOLD_MS } from "../src/inbox-router";

const tmpDir = join(import.meta.dir, ".tmp-test");

beforeEach(() => {
  mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// --- resolveInboxTargets ---

test("resolveInboxTargets returns null when no mentions", () => {
  const members = new Set(["researcher", "formatter"]);
  expect(resolveInboxTargets("hello everyone", members)).toBeNull();
});

test("resolveInboxTargets returns valid mentioned members", () => {
  const members = new Set(["researcher", "formatter"]);
  expect(resolveInboxTargets("@researcher what do you think?", members)).toEqual(["researcher"]);
});

test("resolveInboxTargets returns multiple valid mentions", () => {
  const members = new Set(["researcher", "formatter", "frontend-dev"]);
  const result = resolveInboxTargets("@researcher @formatter check this", members);
  expect(result).toEqual(["researcher", "formatter"]);
});

test("resolveInboxTargets returns null for invalid mentions (fallback)", () => {
  const members = new Set(["researcher", "formatter"]);
  expect(resolveInboxTargets("@nobody are you there?", members)).toBeNull();
});

test("resolveInboxTargets filters out invalid mentions, keeps valid", () => {
  const members = new Set(["researcher", "formatter"]);
  const result = resolveInboxTargets("@researcher @nobody thoughts?", members);
  expect(result).toEqual(["researcher"]);
});

test("resolveInboxTargets deduplicates mentions", () => {
  const members = new Set(["researcher"]);
  const result = resolveInboxTargets("@researcher hey @researcher again", members);
  expect(result).toEqual(["researcher"]);
});

test("resolveInboxTargets handles hyphenated agent names", () => {
  const members = new Set(["frontend-dev", "color-demo"]);
  const result = resolveInboxTargets("@frontend-dev can you fix this?", members);
  expect(result).toEqual(["frontend-dev"]);
});

test("resolveInboxTargets returns null for empty members set", () => {
  const members = new Set<string>();
  expect(resolveInboxTargets("@researcher hello", members)).toBeNull();
});

// --- appendToInbox ---

test("appendToInbox creates file if it does not exist", () => {
  const path = join(tmpDir, "agent.json");
  appendToInbox(path, { from: "user", text: "hello", timestamp: "2026-01-01T00:00:00Z", read: false });

  const messages = JSON.parse(readFileSync(path, "utf-8"));
  expect(messages).toHaveLength(1);
  expect(messages[0].from).toBe("user");
  expect(messages[0].text).toBe("hello");
  expect(messages[0].read).toBe(false);
});

test("appendToInbox appends to existing file", () => {
  const path = join(tmpDir, "agent.json");
  writeFileSync(path, JSON.stringify([{ from: "old", text: "old msg", timestamp: "2026-01-01T00:00:00Z", read: true }]));

  appendToInbox(path, { from: "user", text: "new msg", timestamp: "2026-01-02T00:00:00Z", read: false });

  const messages = JSON.parse(readFileSync(path, "utf-8"));
  expect(messages).toHaveLength(2);
  expect(messages[0].from).toBe("old");
  expect(messages[1].from).toBe("user");
});

test("appendToInbox creates nested directories", () => {
  const path = join(tmpDir, "deep", "nested", "agent.json");
  appendToInbox(path, { from: "user", text: "hi", timestamp: "2026-01-01T00:00:00Z", read: false });

  const messages = JSON.parse(readFileSync(path, "utf-8"));
  expect(messages).toHaveLength(1);
});

// --- getTeamMembers ---

test("getTeamMembers reads member names from config", () => {
  const teamDir = join(tmpDir, "my-team");
  mkdirSync(teamDir, { recursive: true });
  writeFileSync(join(teamDir, "config.json"), JSON.stringify({
    members: [
      { name: "team-lead", agentType: "team-lead" },
      { name: "researcher", agentType: "general-purpose" },
      { name: "formatter", agentType: "general-purpose" },
    ]
  }));

  const members = getTeamMembers(teamDir);
  expect(members).toEqual(new Set(["team-lead", "researcher", "formatter"]));
});

test("getTeamMembers returns empty set for missing config", () => {
  const members = getTeamMembers(join(tmpDir, "nonexistent"));
  expect(members).toEqual(new Set());
});

test("getTeamMembers returns empty set for invalid JSON", () => {
  const teamDir = join(tmpDir, "bad-team");
  mkdirSync(teamDir, { recursive: true });
  writeFileSync(join(teamDir, "config.json"), "not json");

  const members = getTeamMembers(teamDir);
  expect(members).toEqual(new Set());
});

// --- checkIdleAgents ---

test("checkIdleAgents returns empty when no members", () => {
  const notified = new Set<string>();
  const result = checkIdleAgents(tmpDir, new Set(), "team-lead", notified);
  expect(result).toEqual([]);
});

test("checkIdleAgents returns empty when all inbox files are recent", () => {
  const inboxDir = join(tmpDir, "inboxes");
  mkdirSync(inboxDir, { recursive: true });
  writeFileSync(join(inboxDir, "researcher.json"), "[]");

  const notified = new Set<string>();
  const members = new Set(["team-lead", "researcher"]);
  const result = checkIdleAgents(inboxDir, members, "team-lead", notified);
  expect(result).toEqual([]);
});

test("checkIdleAgents returns agent name when inbox file is stale", () => {
  const inboxDir = join(tmpDir, "inboxes");
  mkdirSync(inboxDir, { recursive: true });
  writeFileSync(join(inboxDir, "researcher.json"), "[]");

  const notified = new Set<string>();
  const members = new Set(["team-lead", "researcher"]);
  const staleTime = Date.now() + IDLE_THRESHOLD_MS + 1000;
  const result = checkIdleAgents(inboxDir, members, "team-lead", notified, staleTime);
  expect(result).toEqual(["researcher"]);
});

test("checkIdleAgents skips agent when inbox file does not exist (new agent)", () => {
  const inboxDir = join(tmpDir, "inboxes");
  mkdirSync(inboxDir, { recursive: true });

  const notified = new Set<string>();
  const members = new Set(["team-lead", "researcher"]);
  const result = checkIdleAgents(inboxDir, members, "team-lead", notified);
  expect(result).toEqual([]);
});

test("checkIdleAgents skips the excluded agent", () => {
  const inboxDir = join(tmpDir, "inboxes");
  mkdirSync(inboxDir, { recursive: true });

  const notified = new Set<string>();
  const members = new Set(["team-lead", "researcher"]);
  const staleTime = Date.now() + IDLE_THRESHOLD_MS + 1000;
  const result = checkIdleAgents(inboxDir, members, "team-lead", notified, staleTime);
  expect(result).not.toContain("team-lead");
});

test("checkIdleAgents does not return already-notified agents", () => {
  const inboxDir = join(tmpDir, "inboxes");
  mkdirSync(inboxDir, { recursive: true });

  const notified = new Set(["researcher"]);
  const members = new Set(["team-lead", "researcher"]);
  const result = checkIdleAgents(inboxDir, members, "team-lead", notified);
  expect(result).toEqual([]);
});

test("checkIdleAgents clears notified when file is recently updated", () => {
  const inboxDir = join(tmpDir, "inboxes");
  mkdirSync(inboxDir, { recursive: true });
  writeFileSync(join(inboxDir, "researcher.json"), "[]");

  const notified = new Set(["researcher"]);
  const members = new Set(["team-lead", "researcher"]);
  checkIdleAgents(inboxDir, members, "team-lead", notified);
  expect(notified.has("researcher")).toBe(false);
});
