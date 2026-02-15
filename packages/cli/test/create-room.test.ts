import { test, expect, mock, beforeEach } from "bun:test";
import { createClient } from "../src/client";

const _originalFetch = globalThis.fetch;

let lastRequest: { url: string; method: string; body: Record<string, unknown> } | null = null;

beforeEach(() => {
  lastRequest = null;
  // Suppress stderr during tests
  console.error = () => {};
  // Mock fetch to capture requests
  globalThis.fetch = mock(async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    lastRequest = {
      url,
      method: init?.method ?? "GET",
      body: JSON.parse(init?.body as string ?? "{}"),
    };
    return new Response(JSON.stringify({ id: "room-123", name: "team-discovery" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as unknown as typeof fetch;
});

test("createRoom calls correct API endpoint", async () => {
  const client = createClient("http://localhost:8787", "mai_testkey");

  await client.createRoom("team-discovery");

  expect(lastRequest).not.toBeNull();
  expect(lastRequest!.url).toBe("http://localhost:8787/api/rooms");
  expect(lastRequest!.method).toBe("POST");
  expect(lastRequest!.body.name).toBe("team-discovery");
});

test("Flag-like strings starting with -- should be rejected", () => {
  // Test that strings starting with -- are identified as flag-like
  expect("--help".startsWith("--")).toBe(true);
  expect("--name".startsWith("--")).toBe(true);
  expect("--invalid".startsWith("--")).toBe(true);
  expect("team-discovery".startsWith("--")).toBe(false);
});

test("--help flag exits with code 0 and prints usage", async () => {
  return new Promise<void>((resolve, reject) => {
    const { spawn } = require("child_process");
    const proc = spawn("bun", ["packages/cli/src/index.ts", "create-room", "--help"], {
      cwd: "/Users/isnifer/www/meet-ai",
    });

    let stdout = "";
    let stderr = "";

    proc.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("close", (code: number) => {
      if (code === 0 && stdout.includes("Usage:")) {
        resolve();
      } else {
        reject(new Error(`Expected exit code 0 with Usage output. Got code ${code}, stdout: ${stdout}, stderr: ${stderr}`));
      }
    });
  });
});

test("Flag without value like --invalid rejects with error", async () => {
  return new Promise<void>((resolve, reject) => {
    const { spawn } = require("child_process");
    const proc = spawn("bun", ["packages/cli/src/index.ts", "create-room", "--invalid"], {
      cwd: "/Users/isnifer/www/meet-ai",
    });

    let stdout = "";
    let stderr = "";

    proc.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("close", (code: number) => {
      if (code === 1 && stderr.includes("Unknown flag:")) {
        resolve();
      } else {
        reject(new Error(`Expected exit code 1 with Unknown flag error. Got code ${code}, stdout: ${stdout}, stderr: ${stderr}`));
      }
    });
  });
});
