import { describe, it, expect, beforeAll, afterAll, afterEach } from "bun:test";
import { unlinkSync } from "node:fs";
import { runCli } from "../helpers/run-cli";

// ---------- Mock server ----------

let server: ReturnType<typeof Bun.serve> | undefined;
let baseUrl: string;

beforeAll(() => {
  const port = Math.floor(Math.random() * 10000) + 40000;
  server = Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);
      const method = req.method;

      // POST /api/rooms — create room
      if (method === "POST" && url.pathname === "/api/rooms") {
        const body = (await req.json()) as { name: string };
        return Response.json({ id: "room-abc-123", name: body.name });
      }

      // POST /api/rooms/:id/messages — send message
      if (method === "POST" && /^\/api\/rooms\/[^/]+\/messages$/.test(url.pathname)) {
        const body = (await req.json()) as { sender: string; content: string };
        return Response.json({
          id: "msg-001",
          roomId: "room-abc-123",
          sender: body.sender,
          sender_type: "agent",
          content: body.content,
        });
      }

      // GET /api/rooms/:id/messages — poll
      if (method === "GET" && /^\/api\/rooms\/[^/]+\/messages$/.test(url.pathname)) {
        return Response.json([]);
      }

      // GET /api/rooms/:roomId/messages/:msgId/attachments — message attachments
      if (method === "GET" && /^\/api\/rooms\/[^/]+\/messages\/[^/]+\/attachments$/.test(url.pathname)) {
        return Response.json([]);
      }

      // POST /api/keys — generate key
      if (method === "POST" && url.pathname === "/api/keys") {
        return Response.json({ key: "mai_test_abc123", prefix: "mai_test" });
      }

      // GET /api/attachments/:id — download attachment
      if (method === "GET" && /^\/api\/attachments\/[^/]+$/.test(url.pathname)) {
        return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
      }

      // DELETE /api/rooms/:id — delete room
      if (method === "DELETE" && /^\/api\/rooms\/[^/]+$/.test(url.pathname)) {
        return new Response(null, { status: 204 });
      }

      return Response.json({ error: "Not found" }, { status: 404 });
    },
  });
  baseUrl = `http://localhost:${server.port}`;
});

afterAll(() => {
  server?.stop(true);
});

function env(extra?: Record<string, string>) {
  return { MEET_AI_URL: baseUrl, MEET_AI_KEY: "mai_testkey123", ...extra };
}

// ---------- Success paths ----------

describe("success paths (mock server)", () => {
  it("create-room prints room ID and exits 0", async () => {
    // GIVEN a running mock server
    // WHEN we create a room via CLI
    const result = await runCli(["create-room", "test-room"], env());

    // THEN it exits 0 and stdout contains the room ID
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("room-abc-123");
  });

  it("send-message prints message ID and exits 0", async () => {
    // GIVEN a running mock server
    // WHEN we send a message via CLI
    const result = await runCli(
      ["send-message", "room-abc-123", "bot", "hello world"],
      env(),
    );

    // THEN it exits 0 and stdout contains the message ID
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("msg-001");
  });

  it("poll returns JSON array and exits 0", async () => {
    // GIVEN a running mock server
    // WHEN we poll messages via CLI
    const result = await runCli(["poll", "room-abc-123"], env());

    // THEN it exits 0 and stdout is a valid JSON array
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(Array.isArray(parsed)).toBe(true);
  });

  it("generate-key prints key and exits 0", async () => {
    // GIVEN a running mock server
    // WHEN we generate a key via CLI
    const result = await runCli(["generate-key"], env());

    // THEN it exits 0 and stdout contains the key
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("mai_test_abc123");
  });

  it("delete-room prints success and exits 0", async () => {
    // GIVEN a running mock server
    // WHEN we delete a room via CLI
    const result = await runCli(["delete-room", "room-abc-123"], env());

    // THEN it exits 0 and stdout confirms deletion
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("room-abc-123");
  });

  it("download-attachment downloads file and exits 0", async () => {
    // GIVEN a running mock server that serves attachment binary data
    // WHEN we download an attachment via CLI
    const result = await runCli(["download-attachment", "test-att-123"], env());

    // THEN it exits 0 and stdout contains the local file path
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("/tmp/meet-ai-attachments/");

    // Clean up downloaded file
    try { unlinkSync("/tmp/meet-ai-attachments/test-att-123.bin"); } catch {}
  });
});

// ---------- Validation failure paths ----------

describe("validation failure paths", () => {
  it("send-message with no args exits 1", async () => {
    // GIVEN no arguments
    // WHEN we invoke send-message
    const result = await runCli(["send-message"], env());

    // THEN it exits 1 and stderr has an error
    expect(result.exitCode).toBe(1);
    expect(result.stderr.length).toBeGreaterThan(0);
  });

  it("create-room with no args exits 1", async () => {
    // GIVEN no room name argument
    // WHEN we invoke create-room
    const result = await runCli(["create-room"], env());

    // THEN it exits 1 and stderr has an error
    expect(result.exitCode).toBe(1);
    expect(result.stderr.length).toBeGreaterThan(0);
  });

  it("send-message with empty roomId exits 1", async () => {
    // GIVEN an empty string for roomId
    // WHEN we invoke send-message
    const result = await runCli(["send-message", "", "bot", "hello"], env());

    // THEN it exits 1 due to zod validation (empty roomId)
    expect(result.exitCode).toBe(1);
    expect(result.stderr.length).toBeGreaterThan(0);
  });

  it("download-attachment with no args exits 1", async () => {
    // GIVEN no attachment ID argument
    // WHEN we invoke download-attachment
    const result = await runCli(["download-attachment"], env());

    // THEN it exits 1 and stderr has an error
    expect(result.exitCode).toBe(1);
    expect(result.stderr.length).toBeGreaterThan(0);
  });
});

// ---------- API failure paths ----------

describe("API failure paths", () => {
  it("create-room with unreachable server exits 1 with error", async () => {
    // GIVEN a server URL that nothing is listening on
    // WHEN we try to create a room
    const result = await runCli(["create-room", "test-room"], {
      MEET_AI_URL: "http://127.0.0.1:1",
      MEET_AI_KEY: "mai_testkey123",
    });

    // THEN it exits 1 and stderr has an error (no raw stack traces)
    expect(result.exitCode).toBe(1);
    expect(result.stderr.length).toBeGreaterThan(0);
    expect(result.stderr).not.toContain("    at ");
  });

  it("send-message with unreachable server exits 1 with error", async () => {
    // GIVEN a server URL that nothing is listening on
    // WHEN we try to send a message
    const result = await runCli(
      ["send-message", "room-123", "bot", "hello"],
      { MEET_AI_URL: "http://127.0.0.1:1", MEET_AI_KEY: "mai_testkey123" },
    );

    // THEN it exits 1 and stderr has an error (no raw stack traces)
    expect(result.exitCode).toBe(1);
    expect(result.stderr.length).toBeGreaterThan(0);
    expect(result.stderr).not.toContain("    at ");
  });

  it("generate-key with unreachable server exits 1 with error", async () => {
    // GIVEN a server URL that nothing is listening on
    // WHEN we try to generate a key
    const result = await runCli(["generate-key"], {
      MEET_AI_URL: "http://127.0.0.1:1",
      MEET_AI_KEY: "mai_testkey123",
    });

    // THEN it exits 1 and stderr has an error (no raw stack traces)
    expect(result.exitCode).toBe(1);
    expect(result.stderr.length).toBeGreaterThan(0);
    expect(result.stderr).not.toContain("    at ");
  });
});

// ---------- Help text ----------

describe("help text", () => {
  it("--help exits 0 and shows command list", async () => {
    // GIVEN the --help flag
    // WHEN we invoke the CLI
    const result = await runCli(["--help"]);

    // THEN it exits 0 and stdout lists available commands
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("create-room");
    expect(result.stdout).toContain("send-message");
    expect(result.stdout).toContain("poll");
  });

  it("create-room --help exits 0 and shows description", async () => {
    // GIVEN the --help flag on a subcommand
    // WHEN we invoke create-room --help
    const result = await runCli(["create-room", "--help"]);

    // THEN it exits 0 and stdout describes the command
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Create a new chat room");
  });

  it("send-message --help exits 0 and shows description", async () => {
    // GIVEN the --help flag on a subcommand
    // WHEN we invoke send-message --help
    const result = await runCli(["send-message", "--help"]);

    // THEN it exits 0 and stdout describes the command
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Send a message");
  });

  it("poll --help exits 0 and shows description", async () => {
    // GIVEN the --help flag on a subcommand
    // WHEN we invoke poll --help
    const result = await runCli(["poll", "--help"]);

    // THEN it exits 0 and stdout describes the command
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Poll for new messages");
  });
});
