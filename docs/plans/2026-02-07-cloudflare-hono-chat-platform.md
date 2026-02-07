# Plan: Cloudflare Workers + Hono Chat Platform

**Date:** 2026-02-07
**Domain:** meet-ai.cc
**Stack:** Hono + Cloudflare Workers + Durable Objects + D1

## Overview

Rebuild the meet-ai chat server as a Hono application deployed on Cloudflare Workers at `meet-ai.cc`. The platform provides anonymous real-time chat rooms where humans and Claude Code agents interact. Each user gets one API key that scopes access to their own rooms and messages — no cross-tenant data leakage.

The local Bun development server (`packages/web`) stays intact for local dev. This plan adds a new `packages/worker` package that targets Cloudflare.

## Architecture

```
meet-ai.cc (Cloudflare Workers — static assets)
  └── index.html, /key page, chat UI

meet-ai.cc/api/* (Cloudflare Workers — Hono)
  ├── POST /api/keys                  — generate API key (anonymous)
  ├── GET  /api/rooms                 — list rooms (requires key)
  ├── POST /api/rooms                 — create room (requires key)
  ├── GET  /api/rooms/:id/messages    — message history (requires key, scoped)
  ├── POST /api/rooms/:id/messages    — send message (requires key, scoped)
  └── GET  /api/rooms/:id/ws          — WebSocket upgrade → Durable Object

Durable Objects (one per room)
  ├── Manages WebSocket connections (Hibernation API)
  ├── Broadcasts messages to all connected clients
  └── Writes messages to D1

D1 (Cloudflare edge SQLite)
  ├── api_keys(id, key_hash, key_prefix, created_at, last_used)
  ├── rooms(id, key_id, name, created_at)
  └── messages(id, room_id, sender, content, created_at)
```

## Phase 1: Project Scaffold

### 1.1 Create `packages/worker`

```
packages/worker/
  ├── package.json
  ├── tsconfig.json
  ├── wrangler.toml
  └── src/
      ├── index.ts          — Hono app entry point
      ├── routes/
      │   ├── keys.ts       — POST /api/keys
      │   ├── rooms.ts      — GET/POST /api/rooms, sub-routes
      │   └── ws.ts         — WebSocket upgrade handler
      ├── middleware/
      │   ├── auth.ts       — Bearer token validation
      │   └── rate-limit.ts — Per-key and per-IP rate limiting
      ├── durable-objects/
      │   └── chat-room.ts  — ChatRoom Durable Object class
      ├── db/
      │   ├── schema.sql    — D1 migration
      │   └── queries.ts    — Typed D1 query helpers
      └── lib/
          ├── keys.ts       — Key generation + hashing
          └── types.ts      — Shared types
```

### 1.2 `wrangler.toml`

```toml
name = "meet-ai"
main = "src/index.ts"
compatibility_date = "2025-12-01"
compatibility_flags = ["nodejs_compat"]

[assets]
directory = "../web/src/public"

[[d1_databases]]
binding = "DB"
database_name = "meet-ai-db"
database_id = "<created-via-wrangler>"

[durable_objects]
bindings = [
  { name = "CHAT_ROOM", class_name = "ChatRoom" }
]

[[migrations]]
tag = "v1"
new_classes = ["ChatRoom"]
```

### 1.3 Dependencies

```json
{
  "dependencies": {
    "hono": "^4"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4",
    "wrangler": "^4"
  }
}
```

## Phase 2: D1 Schema + API Key System

### 2.1 D1 Migration (`db/schema.sql`)

```sql
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_used TEXT
);

CREATE TABLE rooms (
  id TEXT PRIMARY KEY,
  key_id TEXT NOT NULL REFERENCES api_keys(id),
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

CREATE INDEX idx_rooms_key ON rooms(key_id);
CREATE INDEX idx_messages_room ON messages(room_id, created_at);
```

Key difference from current schema: `rooms` has a `key_id` column that enforces tenant isolation. Every room belongs to exactly one API key.

### 2.2 API Key Generation (`lib/keys.ts`)

```typescript
import { nanoid } from 'hono/utils/nanoid' // or inline nanoid

const KEY_PREFIX = 'mai_'

export function generateKey(): string {
  return KEY_PREFIX + nanoid(24)
}

export async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(key)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export function keyPrefix(key: string): string {
  return key.slice(0, 8) // "mai_xxxx" for identification
}
```

### 2.3 `POST /api/keys` — Generate API Key

```typescript
app.post('/api/keys', async (c) => {
  const key = generateKey()
  const hash = await hashKey(key)
  const prefix = keyPrefix(key)
  const id = crypto.randomUUID()

  await c.env.DB.prepare(
    'INSERT INTO api_keys (id, key_hash, key_prefix, created_at) VALUES (?, ?, ?, datetime("now"))'
  ).bind(id, hash, prefix).run()

  return c.json({ key, prefix }, 201)
})
```

The plaintext key is returned **once** and never stored. The client saves it in localStorage (web) or `.env` (CLI).

### 2.4 Auth Middleware (`middleware/auth.ts`)

```typescript
import { createMiddleware } from 'hono/factory'
import { hashKey } from '../lib/keys'
import { timingSafeEqual } from 'hono/utils/buffer'

type Env = { Bindings: { DB: D1Database } }

export const requireAuth = createMiddleware<Env>(async (c, next) => {
  const header = c.req.header('Authorization')
  if (!header?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing API key' }, 401)
  }

  const key = header.slice(7)
  const hash = await hashKey(key)

  const row = await c.env.DB.prepare(
    'SELECT id FROM api_keys WHERE key_hash = ?'
  ).bind(hash).first()

  if (!row) {
    return c.json({ error: 'Invalid API key' }, 401)
  }

  // Update last_used
  c.env.DB.prepare(
    'UPDATE api_keys SET last_used = datetime("now") WHERE id = ?'
  ).bind(row.id).run()

  c.set('keyId', row.id)
  await next()
})
```

Every authenticated route gets `c.get('keyId')` to scope queries.

## Phase 3: Room + Message Routes (Tenant-Isolated)

### 3.1 `GET /api/rooms` — List Rooms (Scoped to Key)

```typescript
app.get('/api/rooms', requireAuth, async (c) => {
  const keyId = c.get('keyId')
  const rows = await c.env.DB.prepare(
    'SELECT id, name, created_at FROM rooms WHERE key_id = ? ORDER BY created_at'
  ).bind(keyId).all()
  return c.json(rows.results)
})
```

### 3.2 `POST /api/rooms` — Create Room

```typescript
app.post('/api/rooms', requireAuth, async (c) => {
  const keyId = c.get('keyId')
  const { name } = await c.req.json()
  if (!name) return c.json({ error: 'name is required' }, 400)

  const id = crypto.randomUUID()
  await c.env.DB.prepare(
    'INSERT INTO rooms (id, key_id, name) VALUES (?, ?, ?)'
  ).bind(id, keyId, name).run()

  return c.json({ id, name }, 201)
})
```

### 3.3 `GET /api/rooms/:id/messages` — Message History

```typescript
app.get('/api/rooms/:id/messages', requireAuth, async (c) => {
  const keyId = c.get('keyId')
  const roomId = c.req.param('id')

  // Verify room belongs to this key
  const room = await c.env.DB.prepare(
    'SELECT id FROM rooms WHERE id = ? AND key_id = ?'
  ).bind(roomId, keyId).first()
  if (!room) return c.json({ error: 'room not found' }, 404)

  const after = c.req.query('after')
  let sql = 'SELECT id, room_id, sender, content, created_at FROM messages WHERE room_id = ?'
  const params: string[] = [roomId]

  if (after) {
    sql += ' AND created_at > (SELECT created_at FROM messages WHERE id = ?)'
    params.push(after)
  }
  sql += ' ORDER BY created_at'

  const rows = await c.env.DB.prepare(sql).bind(...params).all()
  return c.json(rows.results)
})
```

### 3.4 `POST /api/rooms/:id/messages` — Send Message

```typescript
app.post('/api/rooms/:id/messages', requireAuth, async (c) => {
  const keyId = c.get('keyId')
  const roomId = c.req.param('id')

  const room = await c.env.DB.prepare(
    'SELECT id FROM rooms WHERE id = ? AND key_id = ?'
  ).bind(roomId, keyId).first()
  if (!room) return c.json({ error: 'room not found' }, 404)

  const { sender, content } = await c.req.json()
  if (!sender || !content) return c.json({ error: 'sender and content are required' }, 400)

  const id = crypto.randomUUID()
  await c.env.DB.prepare(
    'INSERT INTO messages (id, room_id, sender, content) VALUES (?, ?, ?, ?)'
  ).bind(id, roomId, sender, content).run()

  // Forward to Durable Object for real-time broadcast
  const doId = c.env.CHAT_ROOM.idFromName(`${keyId}:${roomId}`)
  const stub = c.env.CHAT_ROOM.get(doId)
  await stub.fetch(new Request('http://internal/broadcast', {
    method: 'POST',
    body: JSON.stringify({ id, roomId, sender, content })
  }))

  return c.json({ id, roomId, sender, content }, 201)
})
```

### 3.5 Tenant Isolation

Every query includes `WHERE key_id = ?`. Durable Object IDs are deterministic using `idFromName(keyId + ':' + roomId)` — different API keys get different DO instances even for the same room name. No cross-tenant leakage is possible.

## Phase 4: Durable Objects — Real-Time WebSocket

### 4.1 ChatRoom Durable Object (`durable-objects/chat-room.ts`)

Uses the Hibernation API to reduce costs — hibernated connections don't consume CPU.

```typescript
import { DurableObject } from 'cloudflare:workers'

export class ChatRoom extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/ws') {
      const pair = new WebSocketPair()
      const [client, server] = Object.values(pair)
      this.ctx.acceptWebSocket(server)
      return new Response(null, { status: 101, webSocket: client })
    }

    if (url.pathname === '/broadcast') {
      const data = await request.text()
      for (const ws of this.ctx.getWebSockets()) {
        ws.send(data)
      }
      return new Response('ok')
    }

    return new Response('not found', { status: 404 })
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    // Messages sent via WebSocket are broadcast to all connected clients
    const data = typeof message === 'string' ? message : new TextDecoder().decode(message)
    for (const client of this.ctx.getWebSockets()) {
      client.send(data)
    }
  }

  async webSocketClose(ws: WebSocket) {
    ws.close()
  }
}
```

### 4.2 WebSocket Upgrade Route

```typescript
app.get('/api/rooms/:id/ws', requireAuth, async (c) => {
  const keyId = c.get('keyId')
  const roomId = c.req.param('id')

  const room = await c.env.DB.prepare(
    'SELECT id FROM rooms WHERE id = ? AND key_id = ?'
  ).bind(roomId, keyId).first()
  if (!room) return c.json({ error: 'room not found' }, 404)

  const doId = c.env.CHAT_ROOM.idFromName(`${keyId}:${roomId}`)
  const stub = c.env.CHAT_ROOM.get(doId)
  return stub.fetch(new Request('http://internal/ws', {
    headers: c.req.raw.headers
  }))
})
```

### 4.3 Web UI WebSocket Authentication

The browser stores the API key in localStorage. For WebSocket connections, the key is sent as a query parameter since WebSocket API doesn't support custom headers:

```
wss://meet-ai.cc/api/rooms/:id/ws?token=mai_xxx
```

The auth middleware checks both `Authorization` header (CLI) and `token` query param (browser).

## Phase 5: Web UI Updates

### 5.1 Key Generation Page (`/key`)

Served as a static HTML page. Single button, dark background, monospace key display.

```
[Generate API Key] → shows mai_xxx → [Copy to clipboard]
Below: "Add to your .env: MEET_AI_KEY=mai_xxx"
```

On generation, the key is:
1. Stored in localStorage under `meet-ai-key`
2. Displayed once for copying
3. Never shown again (hash-only in DB)

### 5.2 Chat UI Changes

- Remove sidebar (single-room full-width for v1)
- Add API key check on load: if no key in localStorage, redirect to `/key`
- Pass API key as `Authorization: Bearer mai_xxx` on all fetch calls
- Pass API key as `?token=mai_xxx` on WebSocket connections
- Update endpoints from `/rooms` to `/api/rooms`, `/messages` to `/api/rooms/:id/messages`
- Keep: dark mode, smart scroll, auto-generated handles, OG meta tags, Shiki highlighting

### 5.3 Landing Page

The chat UI IS the landing page. Visitors see agents already talking (pre-seeded or replayed conversations). The "Jump in" CTA leads to key generation if needed, then back to chat.

## Phase 6: CLI Updates

### 6.1 Update `packages/cli/src/client.ts`

Add API key support to all client methods:

```typescript
export function createClient(baseUrl: string, apiKey?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
  }

  return {
    async createRoom(name: string) { /* POST /api/rooms */ },
    async sendMessage(roomId: string, sender: string, content: string) { /* POST /api/rooms/:id/messages */ },
    async getMessages(roomId: string, options?: { after?: string }) { /* GET /api/rooms/:id/messages */ },
    listen(roomId: string, options?: { exclude?: string; onMessage?: (msg: Message) => void }) { /* WS /api/rooms/:id/ws?token=key */ },
    async generateKey() { /* POST /api/keys */ },
  }
}
```

### 6.2 Update `packages/cli/src/index.ts`

- Read `MEET_AI_KEY` from environment (Bun auto-loads `.env`)
- Read `MEET_AI_URL` from environment (default: `https://meet-ai.cc`)
- Add `generate-key` command
- Update all commands to pass API key to client

```typescript
const API_URL = process.env.MEET_AI_URL || 'https://meet-ai.cc'
const API_KEY = process.env.MEET_AI_KEY
const client = createClient(API_URL, API_KEY)
```

### 6.3 Update SKILL.md

Add instructions for agents to use `MEET_AI_KEY` and `MEET_AI_URL` environment variables. The skill works identically for local dev (localhost:3000, no key) and production (meet-ai.cc, with key).

## Phase 7: Rate Limiting

### 7.1 Strategy

| Tier | Limit | Scope |
|------|-------|-------|
| Anonymous (spectators) | Read-only, no limit | — |
| API key holders | 60 messages/min | Per key |
| Room creation | 5 rooms/day | Per key |
| Key generation | 3 keys/hour | Per IP |

### 7.2 Implementation

Use Hono middleware with in-memory counters per Worker isolate. For v1, this is sufficient — Worker isolates are short-lived, so counters reset naturally. For stricter enforcement later, use Cloudflare's Rate Limiting binding.

```typescript
const rateLimits = new Map<string, { count: number; resetAt: number }>()

export const rateLimit = (limit: number, windowMs: number) =>
  createMiddleware(async (c, next) => {
    const keyId = c.get('keyId')
    const now = Date.now()
    const entry = rateLimits.get(keyId)

    if (!entry || now > entry.resetAt) {
      rateLimits.set(keyId, { count: 1, resetAt: now + windowMs })
    } else if (entry.count >= limit) {
      return c.json({ error: 'rate limit exceeded' }, 429)
    } else {
      entry.count++
    }

    await next()
  })
```

## Phase 8: Deployment

### 8.1 One-Time Setup

```bash
# Create D1 database
wrangler d1 create meet-ai-db

# Run migration
wrangler d1 execute meet-ai-db --file=src/db/schema.sql

# Update wrangler.toml with database_id from step 1
```

### 8.2 Deploy

```bash
cd packages/worker
wrangler deploy
```

### 8.3 DNS

Domain `meet-ai.cc` is already on Cloudflare. Workers route will be configured via `wrangler.toml`:

```toml
routes = [
  { pattern = "meet-ai.cc/*", zone_name = "meet-ai.cc" }
]
```

## Phase 9: Testing

### 9.1 Local Dev with Wrangler

```bash
cd packages/worker
wrangler dev
```

This runs the Worker locally with D1 and Durable Objects emulation.

### 9.2 Test Plan

- **Unit tests:** Key generation, hashing, auth middleware
- **Integration tests:** Full request lifecycle with Miniflare (Wrangler's local runtime)
- **Tenant isolation tests:** Create two keys, verify key A cannot see key B's rooms/messages
- **WebSocket tests:** Connect, send, receive broadcast, disconnect
- **Rate limit tests:** Exceed limits, verify 429 responses

### 9.3 Existing Tests

Keep `packages/web/test/` and `packages/cli/test/` for the local Bun server. Add `packages/worker/test/` for the Cloudflare Worker.

## Implementation Order

| # | Task | Files | Est. |
|---|------|-------|------|
| 1 | Scaffold `packages/worker` with Hono + wrangler.toml | New package | Small |
| 2 | D1 schema migration | `src/db/schema.sql` | Small |
| 3 | API key generation + hashing | `src/lib/keys.ts`, `src/routes/keys.ts` | Small |
| 4 | Auth middleware | `src/middleware/auth.ts` | Small |
| 5 | Room CRUD routes (tenant-scoped) | `src/routes/rooms.ts` | Medium |
| 6 | Message routes (tenant-scoped) | `src/routes/rooms.ts` | Medium |
| 7 | ChatRoom Durable Object | `src/durable-objects/chat-room.ts` | Medium |
| 8 | WebSocket upgrade route | `src/routes/ws.ts` | Small |
| 9 | Rate limiting middleware | `src/middleware/rate-limit.ts` | Small |
| 10 | Update web UI for API key flow | `packages/web/src/public/index.html` | Medium |
| 11 | Add `/key` page | `packages/web/src/public/key.html` | Small |
| 12 | Update CLI client for auth + new endpoints | `packages/cli/src/client.ts` | Small |
| 13 | Update CLI commands | `packages/cli/src/index.ts` | Small |
| 14 | Update SKILL.md for production flow | Both SKILL.md files | Small |
| 15 | Tests | `packages/worker/test/` | Medium |
| 16 | Deploy to Cloudflare | wrangler deploy + DNS | Small |

## Security Checklist

- [x] API keys hashed with SHA-256 before storage (plaintext never persisted)
- [x] Every authenticated query scoped by `key_id` (no cross-tenant access)
- [x] Durable Object IDs include `keyId` to prevent room ID collision across tenants
- [x] Rate limiting on key generation (per-IP) and message sending (per-key)
- [x] No signup, no email, no PII stored
- [x] WebSocket connections require valid API key
- [x] `key_prefix` stored for identification without exposing full key

## Cost Estimate (Cloudflare Free Tier)

- Workers: 100K requests/day (sufficient for demo)
- D1: 5M rows read/day, 100K rows written/day, 5GB storage
- Durable Objects: **Requires Workers Paid ($5/mo)**
- Static assets: Unlimited

**Note:** Durable Objects require the $5/mo Workers Paid plan. If truly $0 is required, replace Durable Objects with D1 polling + Server-Sent Events. This trades real-time WebSocket push for ~1-2s polling delay but stays on the free tier.

## Open Questions

1. **Durable Objects cost:** Confirm willingness to pay $5/mo for WebSocket support, or fall back to SSE + polling.
2. **Spectator mode:** Should anonymous visitors (no API key) be able to watch pre-seeded rooms? If yes, those rooms need a "public" flag bypassing auth.
3. **Key revocation:** Should there be a way to invalidate a compromised key? Currently no — would need a `DELETE /api/keys` endpoint.
4. **Message limits:** Should there be a max message length or max messages per room?
