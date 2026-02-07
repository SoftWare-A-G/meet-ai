import { join } from "path";
import type { Server, ServerWebSocket } from "bun";
import { createDb } from "./db";

type WsData = { roomId: string };

export function createApp(options: { port?: number; dbPath?: string } = {}) {
  const db = createDb(options.dbPath ?? "chat.db");
  const roomClients = new Map<string, Set<ServerWebSocket<WsData>>>();

  async function handleRequest(req: Request, server: Server<WsData>) {
    const url = new URL(req.url);

    // WebSocket upgrade
    if (url.pathname === "/ws") {
      const roomId = url.searchParams.get("roomId");
      if (!roomId) {
        return Response.json({ error: "roomId is required" }, { status: 400 });
      }
      const exists = db.query("SELECT id FROM rooms WHERE id = ?").get(roomId);
      if (!exists) {
        return Response.json({ error: "room not found" }, { status: 404 });
      }
      if (server.upgrade(req, { data: { roomId } })) {
        return undefined;
      }
      return Response.json({ error: "WebSocket upgrade failed" }, { status: 500 });
    }

    // GET /rooms — listRooms
    if (url.pathname === "/rooms" && req.method === "GET") {
      const rows = db.query("SELECT id, name FROM rooms ORDER BY created_at").all();
      return Response.json(rows);
    }

    // POST /rooms — createRoom
    if (url.pathname === "/rooms" && req.method === "POST") {
      const body = (await req.json()) as { name?: string };
      if (!body.name) {
        return Response.json({ error: "name is required" }, { status: 400 });
      }
      const id = crypto.randomUUID();
      db.run("INSERT INTO rooms (id, name) VALUES (?, ?)", [id, body.name]);
      return Response.json({ id, name: body.name }, { status: 201 });
    }

    // GET /messages?roomId=... — listMessages
    if (url.pathname === "/messages" && req.method === "GET") {
      const roomId = url.searchParams.get("roomId");
      if (!roomId) {
        return Response.json({ error: "roomId is required" }, { status: 400 });
      }
      const rows = db
        .query(
          "SELECT id, room_id as roomId, sender, content FROM messages WHERE room_id = ? ORDER BY created_at",
        )
        .all(roomId);
      return Response.json(rows);
    }

    // POST /messages — sendMessage (creates + broadcasts via WebSocket)
    if (url.pathname === "/messages" && req.method === "POST") {
      const body = (await req.json()) as { roomId?: string; sender?: string; content?: string };
      if (!body.roomId || !body.sender || !body.content) {
        return Response.json(
          { error: "roomId, sender, and content are required" },
          { status: 400 },
        );
      }
      const room = db.query("SELECT id FROM rooms WHERE id = ?").get(body.roomId);
      if (!room) {
        return Response.json({ error: "room not found" }, { status: 404 });
      }
      const id = crypto.randomUUID();
      db.run("INSERT INTO messages (id, room_id, sender, content) VALUES (?, ?, ?, ?)", [
        id,
        body.roomId,
        body.sender,
        body.content,
      ]);
      const message = { id, roomId: body.roomId, sender: body.sender, content: body.content };

      // Broadcast to all WebSocket clients in this room
      const clients = roomClients.get(body.roomId);
      if (clients) {
        const payload = JSON.stringify(message);
        for (const ws of clients) {
          ws.send(payload);
        }
      }

      return Response.json(message, { status: 201 });
    }

    // Serve static HTML
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(Bun.file(join(import.meta.dir, "public/index.html")));
    }

    return Response.json({ error: "not found" }, { status: 404 });
  }

  const server = Bun.serve<WsData>({
    port: options.port ?? 3000,

    async fetch(req, server) {
      try {
        return await handleRequest(req, server);
      } catch (e) {
        if (e instanceof SyntaxError) {
          return Response.json({ error: "invalid JSON" }, { status: 400 });
        }
        throw e;
      }
    },

    websocket: {
      open(ws) {
        const { roomId } = ws.data;
        if (!roomClients.has(roomId)) {
          roomClients.set(roomId, new Set());
        }
        roomClients.get(roomId)!.add(ws);
      },
      message(_ws, _msg) {
        // All messaging goes through the REST API
      },
      close(ws) {
        const { roomId } = ws.data;
        roomClients.get(roomId)?.delete(ws);
      },
    },
  });

  return { server, db };
}
