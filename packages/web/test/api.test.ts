import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import type { Database } from "bun:sqlite";
import { createApp } from "../src/app";

let server: ReturnType<typeof createApp>["server"];
let db: Database;
let baseUrl: string;

beforeAll(() => {
  const app = createApp({ port: 0, dbPath: ":memory:" });
  server = app.server;
  db = app.db;
  baseUrl = `http://localhost:${server.port}`;
});

afterAll(() => {
  server.stop();
  db.close();
});

describe("POST /rooms", () => {
  test("creates a room", async () => {
    const res = await fetch(`${baseUrl}/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "general" }),
    });
    expect(res.status).toBe(201);
    const room = await res.json();
    expect(room.name).toBe("general");
    expect(room.id).toBeDefined();
  });

  test("rejects missing name", async () => {
    const res = await fetch(`${baseUrl}/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});

describe("GET /rooms", () => {
  test("lists existing rooms", async () => {
    const res = await fetch(`${baseUrl}/rooms`);
    expect(res.status).toBe(200);
    const rooms = (await res.json()) as { id: string; name: string }[];
    expect(rooms.length).toBeGreaterThanOrEqual(1);
    expect(rooms[0].name).toBeDefined();
  });
});

describe("GET /messages", () => {
  let roomId: string;

  beforeAll(async () => {
    const res = await fetch(`${baseUrl}/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "history-room" }),
    });
    const room = await res.json();
    roomId = room.id;
    for (const text of ["one", "two", "three"]) {
      await fetch(`${baseUrl}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, sender: "tester", content: text }),
      });
    }
  });

  test("returns message history for a room", async () => {
    const res = await fetch(`${baseUrl}/messages?roomId=${roomId}`);
    expect(res.status).toBe(200);
    const msgs = (await res.json()) as { sender: string; content: string }[];
    expect(msgs).toHaveLength(3);
    expect(msgs.map((m) => m.content)).toEqual(["one", "two", "three"]);
  });

  test("rejects missing roomId", async () => {
    const res = await fetch(`${baseUrl}/messages`);
    expect(res.status).toBe(400);
  });

  test("returns messages after a given ID", async () => {
    const allRes = await fetch(`${baseUrl}/messages?roomId=${roomId}`);
    const all = (await allRes.json()) as { id: string; content: string }[];
    const afterId = all[0].id; // after "one"

    const res = await fetch(`${baseUrl}/messages?roomId=${roomId}&after=${afterId}`);
    expect(res.status).toBe(200);
    const msgs = (await res.json()) as { content: string }[];
    expect(msgs).toHaveLength(2);
    expect(msgs.map((m) => m.content)).toEqual(["two", "three"]);
  });

  test("excludes messages from a specific sender", async () => {
    // Add a message from a different sender
    await fetch(`${baseUrl}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, sender: "other", content: "other-msg" }),
    });

    const res = await fetch(`${baseUrl}/messages?roomId=${roomId}&exclude=tester`);
    expect(res.status).toBe(200);
    const msgs = (await res.json()) as { sender: string; content: string }[];
    expect(msgs.every((m) => m.sender !== "tester")).toBe(true);
    expect(msgs.some((m) => m.sender === "other")).toBe(true);
  });

  test("combines after and exclude params", async () => {
    const allRes = await fetch(`${baseUrl}/messages?roomId=${roomId}`);
    const all = (await allRes.json()) as { id: string; sender: string }[];
    const afterId = all[1].id; // after "two"

    const res = await fetch(
      `${baseUrl}/messages?roomId=${roomId}&after=${afterId}&exclude=other`,
    );
    expect(res.status).toBe(200);
    const msgs = (await res.json()) as { sender: string; content: string }[];
    expect(msgs.every((m) => m.sender !== "other")).toBe(true);
    // Should only have "three" (from tester, after "two"), not "other-msg"
    expect(msgs.some((m) => m.content === "three")).toBe(true);
  });
});

describe("POST /messages", () => {
  let roomId: string;

  beforeAll(async () => {
    const res = await fetch(`${baseUrl}/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "chat" }),
    });
    const room = await res.json();
    roomId = room.id;
  });

  test("sends a message with sender", async () => {
    const res = await fetch(`${baseUrl}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, sender: "alice", content: "hello world" }),
    });
    expect(res.status).toBe(201);
    const msg = await res.json();
    expect(msg.content).toBe("hello world");
    expect(msg.sender).toBe("alice");
    expect(msg.roomId).toBe(roomId);
    expect(msg.id).toBeDefined();
  });

  test("rejects missing fields", async () => {
    const res = await fetch(`${baseUrl}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, content: "no sender" }),
    });
    expect(res.status).toBe(400);
  });

  test("rejects unknown room", async () => {
    const res = await fetch(`${baseUrl}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: "nonexistent", sender: "bob", content: "hi" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("WebSocket /ws", () => {
  test("receives broadcast with sender when message is sent", async () => {
    const roomRes = await fetch(`${baseUrl}/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "ws-room" }),
    });
    const room = await roomRes.json();

    const ws = new WebSocket(`ws://localhost:${server.port}/ws?roomId=${room.id}`);

    const received = new Promise<any>((resolve, reject) => {
      ws.onmessage = (event) => resolve(JSON.parse(event.data as string));
      setTimeout(() => reject(new Error("timeout")), 3000);
    });

    await new Promise<void>((resolve) => {
      ws.onopen = () => resolve();
    });

    await fetch(`${baseUrl}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: room.id, sender: "carol", content: "ws test" }),
    });

    const msg = await received;
    expect(msg.content).toBe("ws test");
    expect(msg.sender).toBe("carol");
    expect(msg.roomId).toBe(room.id);

    ws.close();
  });

  test("sends message via WebSocket and stores it", async () => {
    const roomRes = await fetch(`${baseUrl}/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "ws-send-room" }),
    });
    const room = await roomRes.json();

    const ws = new WebSocket(`ws://localhost:${server.port}/ws?roomId=${room.id}`);

    const received = new Promise<any>((resolve, reject) => {
      ws.onmessage = (event) => resolve(JSON.parse(event.data as string));
      setTimeout(() => reject(new Error("timeout")), 3000);
    });

    await new Promise<void>((resolve) => {
      ws.onopen = () => resolve();
    });

    // Send message via WebSocket
    ws.send(JSON.stringify({ sender: "dave", content: "ws-sent message" }));

    const msg = await received;
    expect(msg.sender).toBe("dave");
    expect(msg.content).toBe("ws-sent message");
    expect(msg.roomId).toBe(room.id);
    expect(msg.id).toBeDefined();

    // Verify it's stored in the database
    const historyRes = await fetch(`${baseUrl}/messages?roomId=${room.id}`);
    const history = (await historyRes.json()) as { sender: string; content: string }[];
    expect(history).toHaveLength(1);
    expect(history[0].sender).toBe("dave");
    expect(history[0].content).toBe("ws-sent message");

    ws.close();
  });

  test("WebSocket send rejects invalid JSON", async () => {
    const roomRes = await fetch(`${baseUrl}/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "ws-invalid-room" }),
    });
    const room = await roomRes.json();

    const ws = new WebSocket(`ws://localhost:${server.port}/ws?roomId=${room.id}`);

    const received = new Promise<any>((resolve, reject) => {
      ws.onmessage = (event) => resolve(JSON.parse(event.data as string));
      setTimeout(() => reject(new Error("timeout")), 3000);
    });

    await new Promise<void>((resolve) => {
      ws.onopen = () => resolve();
    });

    ws.send("not json");

    const msg = await received;
    expect(msg.error).toBe("invalid JSON");

    ws.close();
  });

  test("WebSocket send rejects missing fields", async () => {
    const roomRes = await fetch(`${baseUrl}/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "ws-missing-room" }),
    });
    const room = await roomRes.json();

    const ws = new WebSocket(`ws://localhost:${server.port}/ws?roomId=${room.id}`);

    const received = new Promise<any>((resolve, reject) => {
      ws.onmessage = (event) => resolve(JSON.parse(event.data as string));
      setTimeout(() => reject(new Error("timeout")), 3000);
    });

    await new Promise<void>((resolve) => {
      ws.onopen = () => resolve();
    });

    ws.send(JSON.stringify({ content: "no sender" }));

    const msg = await received;
    expect(msg.error).toBe("sender and content are required");

    ws.close();
  });

  test("rejects missing roomId", async () => {
    const res = await fetch(`${baseUrl}/ws`);
    expect(res.status).toBe(400);
  });

  test("rejects unknown room", async () => {
    const res = await fetch(`${baseUrl}/ws?roomId=nonexistent`);
    expect(res.status).toBe(404);
  });
});

describe("404", () => {
  test("returns 404 for unknown routes", async () => {
    const res = await fetch(`${baseUrl}/unknown`);
    expect(res.status).toBe(404);
  });
});
