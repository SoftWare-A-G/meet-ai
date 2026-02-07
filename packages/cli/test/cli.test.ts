import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import type { Database } from "bun:sqlite";
import { createApp } from "@meet-ai/web/src/app";
import { createClient } from "../src/client";

let server: ReturnType<typeof createApp>["server"];
let db: Database;
let client: ReturnType<typeof createClient>;

beforeAll(() => {
  const app = createApp({ port: 0, dbPath: ":memory:" });
  server = app.server;
  db = app.db;
  client = createClient(`http://localhost:${server.port}`);
});

afterAll(() => {
  server.stop();
  db.close();
});

describe("createRoom", () => {
  test("creates a room and returns id + name", async () => {
    const room = await client.createRoom("test-room");
    expect(room.id).toBeDefined();
    expect(room.name).toBe("test-room");
  });

  test("throws on missing name", async () => {
    expect(client.createRoom("")).rejects.toThrow();
  });
});

describe("sendMessage", () => {
  test("sends a message with sender to a room", async () => {
    const room = await client.createRoom("msg-room");
    const msg = await client.sendMessage(room.id, "alice", "hello from cli");
    expect(msg.id).toBeDefined();
    expect(msg.roomId).toBe(room.id);
    expect(msg.sender).toBe("alice");
    expect(msg.content).toBe("hello from cli");
  });

  test("throws on unknown room", async () => {
    expect(client.sendMessage("bad-id", "bob", "nope")).rejects.toThrow("room not found");
  });
});

describe("full flow", () => {
  test("create room → send messages → verify in DB", async () => {
    const room = await client.createRoom("flow-room");
    await client.sendMessage(room.id, "alice", "first");
    await client.sendMessage(room.id, "bob", "second");

    const rows = db
      .query("SELECT sender, content FROM messages WHERE room_id = ? ORDER BY created_at")
      .all(room.id) as { sender: string; content: string }[];

    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ sender: "alice", content: "first" });
    expect(rows[1]).toEqual({ sender: "bob", content: "second" });
  });

  test("create room → connect WebSocket → send message → receive broadcast with sender", async () => {
    const room = await client.createRoom("ws-flow-room");

    const ws = new WebSocket(`ws://localhost:${server.port}/ws?roomId=${room.id}`);

    const received = new Promise<any>((resolve, reject) => {
      ws.onmessage = (event) => resolve(JSON.parse(event.data as string));
      setTimeout(() => reject(new Error("timeout")), 3000);
    });

    await new Promise<void>((resolve) => {
      ws.onopen = () => resolve();
    });

    await client.sendMessage(room.id, "carol", "live message");

    const msg = await received;
    expect(msg.content).toBe("live message");
    expect(msg.sender).toBe("carol");

    ws.close();
  });
});
