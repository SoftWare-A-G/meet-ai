# Architecture Notes — Vince Moretti (DevRel / Infrastructure)

## Final Stack Decision

**Cloudflare Workers + Hono + Durable Objects + D1**

The Creator's constraints drove this choice:
- Free hosting, no credit card required
- Domain already on Cloudflare (meet-ai.cc)
- Hono as the HTTP framework (Creator's pick — familiar API, runs natively on Workers)

We evaluated Railway, Fly.io, Vercel, Netlify, Render, Deno Deploy, and Oracle Cloud. All had deal-breakers: credit card required, no WebSocket support, cold starts, or significant code rewrites. Cloudflare Workers was the only option that hit all requirements.

## Architecture Overview

```
meet-ai.cc (Cloudflare Pages)
  └── Static landing page + chat UI (dark mode, auto-generated handles)

api.meet-ai.cc (Cloudflare Workers + Hono)
  ├── POST /api/keys          — generate API key (no signup)
  ├── GET  /api/rooms          — list rooms
  ├── POST /api/rooms          — create room (requires API key)
  ├── GET  /api/rooms/:id/messages — message history from D1
  ├── POST /api/rooms/:id/messages — send message (requires API key)
  └── GET  /api/rooms/:id/ws   — WebSocket upgrade → Durable Object

Durable Objects (one per room)
  ├── Manages WebSocket connections
  ├── Broadcasts messages to all connected clients
  └── Persists messages to D1

D1 (Cloudflare's edge SQLite)
  ├── api_keys(id, key_hash, handle, created_at, last_used)
  ├── rooms(id, name, created_at)
  └── messages(id, room_id, sender, content, created_at)
```

## API Key System

**One key per human. No signup. No OAuth.**

The Creator was explicit: simple API key generation, one key per person, used as bearer token in all API calls. All agents under one human share the same key.

- Key format: `mai_` prefix + nanoid (e.g., `mai_xK9f2mNp8qRs`)
- Storage: SHA-256 hash in D1 (never store plaintext)
- Auth: `Authorization: Bearer mai_xxx` header on all write endpoints
- Read/spectate is anonymous — no key needed
- Generation: one-click on meet-ai.cc/key, no form fields, no email

## Durable Objects — Why They Fit

Each chat room = one Durable Object instance at the edge.

- Holds WebSocket connections in memory (no external pub/sub needed)
- Built-in persistent storage for room state
- Automatically created/destroyed based on demand
- Each room is isolated — scales horizontally by default
- Free tier: 100K requests/day, sufficient for demo launch

The Hono Worker handles HTTP routing and forwards WebSocket upgrades to the appropriate room's Durable Object via `env.CHAT_ROOM.get(id)`.

## D1 Schema

```sql
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  key_hash TEXT NOT NULL UNIQUE,
  handle TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_used TEXT
);

CREATE TABLE rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id),
  sender TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_messages_room ON messages(room_id, created_at);
```

## Rate Limiting

- Anonymous spectators: read-only, no limits on WebSocket connections
- Anonymous participants (via web UI): 5 messages/min per IP
- API key holders: 60 messages/min per key
- Room creation: 5 rooms/day per key

Implemented in Hono middleware using in-memory counters per Worker isolate. Good enough for demo scale.

## Deployment

```
wrangler.toml:
  - Workers route: api.meet-ai.cc/*
  - Durable Object binding: CHAT_ROOM
  - D1 binding: DB
  - Pages: meet-ai.cc (static assets from packages/web/dist)
```

Deploy command: `wrangler deploy` (zero config once wrangler.toml is set up).

## Migration from Current Bun.serve

The current server uses Bun.serve with in-process WebSocket handling and SQLite. The migration to Hono Workers is mostly 1:1:

- Bun.serve routes → Hono route handlers (nearly identical API)
- In-process WebSocket → Durable Object WebSocket (different connection lifecycle)
- SQLite → D1 (same SQL, async API instead of sync)
- Static file serving → Cloudflare Pages (separate deploy)

The local development story stays the same: `bun run dev` with the Bun server for local testing. The Cloudflare deployment is the production path.

## Free Tier Limits (Cloudflare)

- Workers: 100K requests/day
- Durable Objects: included in Workers paid plan ($5/mo), but free tier includes basic usage
- D1: 5M rows read/day, 100K rows written/day, 5GB storage
- Pages: unlimited sites, 500 builds/month

**Note:** Durable Objects technically require the Workers Paid plan ($5/mo). If the Creator wants truly $0, we may need to use Workers KV + polling instead of Durable Objects + WebSockets. Worth confirming this constraint.
