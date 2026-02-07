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

describe("getMessages", () => {
  test("returns all messages for a room", async () => {
    const room = await client.createRoom("poll-room");
    await client.sendMessage(room.id, "alice", "first");
    await client.sendMessage(room.id, "bob", "second");

    const messages = await client.getMessages(room.id);
    expect(messages).toHaveLength(2);
    expect(messages[0].content).toBe("first");
    expect(messages[1].content).toBe("second");
  });

  test("returns messages after a given ID", async () => {
    const room = await client.createRoom("poll-after-room");
    const m1 = await client.sendMessage(room.id, "alice", "one");
    await client.sendMessage(room.id, "bob", "two");
    await client.sendMessage(room.id, "alice", "three");

    const messages = await client.getMessages(room.id, { after: m1.id });
    expect(messages).toHaveLength(2);
    expect(messages.map((m) => m.content)).toEqual(["two", "three"]);
  });

  test("excludes messages from a specific sender", async () => {
    const room = await client.createRoom("poll-exclude-room");
    await client.sendMessage(room.id, "alice", "from alice");
    await client.sendMessage(room.id, "bob", "from bob");
    await client.sendMessage(room.id, "alice", "also alice");

    const messages = await client.getMessages(room.id, { exclude: "alice" });
    expect(messages).toHaveLength(1);
    expect(messages[0].sender).toBe("bob");
  });

  test("combines after and exclude", async () => {
    const room = await client.createRoom("poll-combo-room");
    const m1 = await client.sendMessage(room.id, "alice", "a1");
    await client.sendMessage(room.id, "bob", "b1");
    await client.sendMessage(room.id, "alice", "a2");

    const messages = await client.getMessages(room.id, { after: m1.id, exclude: "alice" });
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe("b1");
  });
});

describe("listen", () => {
  test("receives messages via WebSocket", async () => {
    const room = await client.createRoom("listen-room");

    const received = new Promise<any>((resolve, reject) => {
      client.listen(room.id, {
        onMessage: (msg) => resolve(msg),
      });
      setTimeout(() => reject(new Error("timeout")), 3000);
    });

    // Give WebSocket time to connect
    await new Promise((r) => setTimeout(r, 100));

    await client.sendMessage(room.id, "alice", "live msg");

    const msg = await received;
    expect(msg.sender).toBe("alice");
    expect(msg.content).toBe("live msg");
  });

  test("filters out excluded sender", async () => {
    const room = await client.createRoom("listen-exclude-room");

    const messages: any[] = [];
    const ws = client.listen(room.id, {
      exclude: "bot",
      onMessage: (msg) => messages.push(msg),
    });

    await new Promise((r) => setTimeout(r, 100));

    await client.sendMessage(room.id, "bot", "should be filtered");
    await client.sendMessage(room.id, "human", "should appear");

    await new Promise((r) => setTimeout(r, 200));

    expect(messages).toHaveLength(1);
    expect(messages[0].sender).toBe("human");

    ws.close();
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
