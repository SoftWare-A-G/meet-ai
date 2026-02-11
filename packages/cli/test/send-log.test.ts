import { test, expect, mock, beforeEach } from "bun:test";
import { createClient } from "../src/client";

const originalFetch = globalThis.fetch;

let lastRequest: { url: string; method: string; body: Record<string, unknown> } | null = null;

beforeEach(() => {
  lastRequest = null;
  // Suppress retry logs during tests
  console.error = () => {};
  // Mock fetch to capture requests
  globalThis.fetch = mock(async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    lastRequest = {
      url,
      method: init?.method ?? "GET",
      body: JSON.parse(init?.body as string ?? "{}"),
    };
    return new Response(JSON.stringify({ id: "log-123", room_id: "room-1", sender: "bot", content: "test" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as unknown as typeof fetch;
});

test("sendLog calls correct API endpoint", async () => {
  const client = createClient("http://localhost:8787", "mai_testkey");

  await client.sendLog("room-1", "bot", "processing task");

  expect(lastRequest).not.toBeNull();
  expect(lastRequest!.url).toBe("http://localhost:8787/api/rooms/room-1/logs");
  expect(lastRequest!.method).toBe("POST");
  expect(lastRequest!.body.sender).toBe("bot");
  expect(lastRequest!.body.content).toBe("processing task");
});

test("sendLog passes --color option", async () => {
  const client = createClient("http://localhost:8787", "mai_testkey");

  await client.sendLog("room-1", "bot", "colored log", "#10b981");

  expect(lastRequest!.body.color).toBe("#10b981");
});

test("sendLog passes --message-id option", async () => {
  const client = createClient("http://localhost:8787", "mai_testkey");

  await client.sendLog("room-1", "bot", "linked log", undefined, "msg-abc-123");

  expect(lastRequest!.body.message_id).toBe("msg-abc-123");
  expect(lastRequest!.body).not.toHaveProperty("color");
});

test("sendLog passes both color and message_id", async () => {
  const client = createClient("http://localhost:8787", "mai_testkey");

  await client.sendLog("room-1", "bot", "full log", "blue", "msg-xyz");

  expect(lastRequest!.body.color).toBe("blue");
  expect(lastRequest!.body.message_id).toBe("msg-xyz");
});

test("sendLog omits color and message_id when not provided", async () => {
  const client = createClient("http://localhost:8787", "mai_testkey");

  await client.sendLog("room-1", "bot", "plain log");

  expect(lastRequest!.body).not.toHaveProperty("color");
  expect(lastRequest!.body).not.toHaveProperty("message_id");
});
