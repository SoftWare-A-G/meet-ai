# Backend Architecture PRD

> Current state analysis and improvement plan for the Meet AI backend (Cloudflare Workers + Hono + D1 + Durable Objects).

---

## Current Architecture Overview

| Layer | Technology | File(s) |
|---|---|---|
| API framework | Hono on Cloudflare Workers | `packages/worker/src/index.ts` |
| Database | D1 (SQLite) | `packages/worker/src/db/queries.ts`, `src/db/schema.sql` |
| Real-time | Durable Objects (Hibernation API) | `packages/worker/src/durable-objects/chat-room.ts` |
| Auth | API key with SHA-256 hash | `packages/worker/src/middleware/auth.ts`, `src/lib/keys.ts` |
| Rate limiting | In-memory Map | `packages/worker/src/middleware/rate-limit.ts` |
| Tests | vitest + @cloudflare/vitest-pool-workers | `packages/worker/test/api.test.ts` (16 tests) |

---

## Key Concept: Rate Limiting is Not Durable

The current rate limiter uses in-memory `Map` objects (`keyStore`, `ipStore`). This has two problems:

1. **Cold start reset** -- Every Worker cold start clears the Maps. A burst of requests across restarts bypasses limits entirely.
2. **Isolate locality** -- Cloudflare runs multiple isolates. Each has its own Map, so a key's request count is never shared across isolates.

**Impact:** The 60 req/min per-key limit on message sending and the 5 req/min per-IP limit on key generation are best-effort, not enforced.

**Fix (Phase 2):** Move rate limit state to a Durable Object. One DO per rate-limit key gives single-writer semantics with strong consistency. The DO stores `{ count, resetAt }` in transient state (no storage needed -- losing it on eviction is acceptable for rate limiting). Alternatively, use D1 with a `rate_limits` table, but DO is lower latency.

---

## Key Concept: Messages Need Pagination

`listMessages` in `queries.ts` returns ALL messages for a room with no LIMIT. A room with 10,000 messages returns 10,000 rows on every initial load.

**Current API:**
- `GET /api/rooms/:id/messages` -- all messages
- `GET /api/rooms/:id/messages?after=<id>` -- messages after a cursor (polling)

**Proposed API:**

| Endpoint | Params | Behavior |
|---|---|---|
| `GET /messages` | `limit=50` (default 50, max 200) | Last N messages (DESC then reverse) |
| `GET /messages` | `before=<id>&limit=50` | Older messages for scroll-up |
| `GET /messages` | `after=<id>&limit=200` | Newer messages for polling |

All responses include a `has_more: boolean` field so the client knows whether to offer "load more."

**Query for `before`:**
```sql
SELECT ... FROM messages
WHERE room_id = ? AND rowid < (SELECT rowid FROM messages WHERE id = ?)
ORDER BY rowid DESC LIMIT ?
```
Results are reversed client-side.

**Query for `limit` only (latest N):**
```sql
SELECT ... FROM messages
WHERE room_id = ?
ORDER BY rowid DESC LIMIT ?
```
Results are reversed client-side.

---

## Key Concept: WebSocket Reconnection + Pagination Consistency

When a client reconnects after a disconnection, it fetches `?after=<lastKnownId>`. Without a LIMIT on this query, a client offline during a busy period could trigger a massive unbounded fetch.

**Fix:** The `after` query must also support `limit` and return `has_more`. The client handles reconnection as:

1. Fetch `?after=lastKnownId&limit=200`
2. If `has_more` is true, show a "Load missed messages" prompt rather than auto-fetching in a loop
3. Deduplicate by message ID against messages already in the DOM

This prevents runaway fetches and keeps the reconnection path bounded.

---

## Key Concept: CORS is Wide Open

```ts
app.use('*', cors())  // allows all origins, all methods
```

This is fine for development. In production, write operations should be restricted to the meet-ai.cc origin. Read operations for public rooms (Phase 2) can remain open to support embeddable widgets.

**Fix (Phase 1):** Configure `cors()` with `origin: ['https://meet-ai.cc']` for mutation routes. Keep `*` for read-only public endpoints.

---

## Key Concept: No Input Validation

Request bodies are parsed with `c.req.json()` and checked with loose truthy guards (`if (!body.name)`). There are no length limits, type checks, or schema validation.

**Risks:**
- Room names of arbitrary length break UI layout
- Message content of arbitrary size can be stored (D1 has a 1MB row limit, but that's a lot of text)
- Sender names with special characters or extreme length

**Fix (Phase 1):** Add Zod schemas via `@hono/zod-validator`:

| Field | Constraint |
|---|---|
| Room name | `z.string().min(1).max(100)` |
| Message sender | `z.string().min(1).max(50)` |
| Message content | `z.string().min(1).max(10_000)` |

Schemas live in `packages/worker/src/lib/schemas.ts`. Long-term, share schemas in a `packages/shared` package for frontend reuse.

---

## Key Concept: Database Index Does Not Match Query

The schema defines:
```sql
CREATE INDEX idx_messages_room ON messages(room_id, created_at);
```

But all queries order by `rowid`, not `created_at`. The index helps filter by `room_id` but does not cover the sort.

**Fix (Phase 1):** This is acceptable as-is for small datasets. SQLite's rowid ordering is implicit and fast. For large rooms (10K+ messages), consider a covering index: `CREATE INDEX idx_messages_room_rowid ON messages(room_id, rowid)`. However, since `rowid` is the primary B-tree key in SQLite, the current index on `room_id` alone is sufficient -- the `created_at` in the composite index is just unused. Simplify to:

```sql
CREATE INDEX idx_messages_room ON messages(room_id);
```

---

## Key Concept: D1 Foreign Keys Are Not Enforced

The schema defines `REFERENCES` constraints, but D1 does not enable `PRAGMA foreign_keys` by default. This means:
- Deleting an API key does not cascade to rooms
- Deleting a room does not cascade to messages
- Inserting a message with a nonexistent `room_id` succeeds silently

**Impact:** Low risk currently because all operations go through the API, which checks `findRoom()` before mutations. But data integrity depends entirely on application logic, not the database.

**Fix (Phase 2):** If D1 supports `PRAGMA foreign_keys = ON` at the binding level, enable it. Otherwise, add a cleanup job or handle cascading deletes in application code.

---

## Key Concept: API Key Generation Has Modulo Bias

```ts
id += ALPHABET[bytes[i] % ALPHABET.length]  // 256 % 62 !== 0
```

`256 % 62 = 8`, so characters at indices 0-7 (A-H) appear ~0.4% more often than others. For a 24-character key, this reduces effective entropy by a negligible amount (from ~142.8 bits to ~142.6 bits).

**Impact:** Negligible for API key generation. Not a security risk in practice.

**Fix (optional):** Use rejection sampling: discard bytes >= 248 (largest multiple of 62 under 256) and re-sample.

---

## Key Concept: Migration Strategy for Schema Changes

Current setup: `wrangler.toml` points to `migrations/` directory. One migration exists (`0001_init.sql`). Tests use `applyD1Migrations(env.DB, env.TEST_MIGRATIONS)`.

**For Phase 2 changes (public rooms, webhooks):**

1. Create `migrations/0002_room_visibility.sql`:
```sql
ALTER TABLE rooms ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private';
```

2. Create `migrations/0003_webhooks.sql`:
```sql
CREATE TABLE IF NOT EXISTS webhooks (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id),
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_webhooks_room ON webhooks(room_id);
```

3. The `applyD1Migrations` helper in vitest-pool-workers picks up new files automatically based on the `migrations_dir` config.

4. Deploy: `wrangler d1 migrations apply meet-ai-db`

---

## Phase 1 -- Foundation (Fix What Blocks Growth)

| # | Task | Complexity | Files Changed |
|---|---|---|---|
| 1 | Add `limit` and `before` params to listMessages | Low | `queries.ts`, `rooms.ts` |
| 2 | Add `has_more` flag to message list responses | Low | `rooms.ts` |
| 3 | Add Zod validation schemas for room and message creation | Low | New `schemas.ts`, `rooms.ts`, `keys.ts` |
| 4 | Tighten CORS to meet-ai.cc origin for write routes | Low | `index.ts` |
| 5 | Simplify messages index (drop unused `created_at` from composite) | Low | New migration |
| 6 | Expand test suite: pagination, validation, edge cases | Medium | `api.test.ts` |
| 7 | Verify `wrangler dev` as canonical local dev setup | Low | README/docs only |

---

## Phase 2 -- Growth Engine (Public Rooms + Durability)

| # | Task | Complexity | Files Changed |
|---|---|---|---|
| 1 | Migration: add `visibility` column to rooms | Low | New migration |
| 2 | Public room read-only endpoints (no auth) | Medium | New `routes/public.ts`, `index.ts` |
| 3 | DO routing for public rooms (namespace key change) | Medium | `rooms.ts`, `ws.ts`, `chat-room.ts` |
| 4 | Durable rate limiting via DO | Medium | `rate-limit.ts`, new DO class |
| 5 | Webhooks table + HMAC dispatch from DO broadcast | Medium | New migration, `chat-room.ts`, new `routes/webhooks.ts` |
| 6 | Room deletion + message cleanup | Low | `queries.ts`, `rooms.ts` |
| 7 | Pagination on listRooms | Low | `queries.ts`, `rooms.ts` |

---

## What's Working Well (No Changes Needed)

- **Multi-tenant isolation** -- All queries scoped by `key_id`. `findRoom(roomId, keyId)` prevents cross-tenant access.
- **Auth middleware** -- SHA-256 hashed keys, `last_used` update via non-blocking `waitUntil()`.
- **Durable Object WebSocket** -- Hibernation API used correctly. Client messages intentionally ignored, forcing persistence through REST API. D1 is always the source of truth.
- **Cursor-based polling** -- The `after` parameter uses rowid subquery, which is more reliable than timestamp-based pagination in SQLite.
- **Test infrastructure** -- vitest-pool-workers with D1 migrations per test provides real Workers runtime testing.
