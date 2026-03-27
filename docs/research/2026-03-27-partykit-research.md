# PartyKit / PartySocket Research

**Date:** 2026-03-27
**Status:** Investigation complete, adoption postponed

## 1. Overview

[PartyKit](https://github.com/cloudflare/partykit) is a Cloudflare-acquired framework for building real-time collaborative applications on top of Durable Objects. The repository contains 7 packages:

| Package | Purpose |
|---------|---------|
| **PartyServer** | Durable Object base class with WebSocket lifecycle helpers |
| **PartySocket** | Browser/Node WebSocket client with auto-reconnect |
| **Y-PartyServer** | Yjs CRDT integration for PartyServer |
| **partysub** | Pub/sub primitives across Durable Objects |
| **partysync** | Experimental state synchronization (Durable Object state <-> client) |
| **partywhen** | Scheduling / alarm helpers for Durable Objects |
| **hono-party** | Hono middleware for routing to PartyServer instances |

PartyServer is now the foundation of Cloudflare's Agents SDK. The inheritance chain is:

```
DurableObject -> PartyServer -> Agent -> AIChatAgent
```

This means PartyServer isn't just a third-party library — it's the upstream base class for all of Cloudflare's agent infrastructure.

## 2. Meet AI Current Architecture

Meet AI has three independent WebSocket transports, each with different levels of robustness:

### `useRoomWebSocket.ts` (407 lines) — Production-grade

The main chat room transport. Features:
- Heartbeat with ping/pong
- Zombie connection detection (no pong reply within timeout)
- Exponential backoff on reconnect
- Resume handlers (visibilitychange, focus, online, pageshow)
- Sequence number (`seq`) tracking for incremental fetch
- `catchUp` mechanism to fetch missed messages on reconnect
- Message deduplication

### CLI `ConnectionAdapter.ts` (263 lines) — Production-grade

The CLI's WebSocket transport for agent connections. Features:
- Exponential backoff with jitter
- Heartbeat ping/pong
- Message deduplication
- Catch-up on reconnect
- Close code handling (1000, 4040, 1006, 1012, 1013)

### `useLobbyWebSocket.ts` (107 lines) — Prototype-grade

The lobby/room-list live-update transport. Features:
- Fixed 3-second reconnect (no backoff)
- No heartbeat
- No deduplication
- No catch-up mechanism

### Three Durable Objects

- **ChatRoom** — main chat DO with message persistence, WebSocket broadcast, plan reviews, question reviews
- **Lobby** — lightweight presence/room-list updates
- **CanvasRoom** — collaborative canvas state

Each DO manages its own WebSocket lifecycle manually.

## 3. PartySocket Analysis

### What it provides

- **Auto-reconnect** with configurable exponential backoff (min/max delay, factor)
- **Message buffering** while disconnected (queues sends, flushes on reconnect)
- **Connection timeout** (configurable, fires `onerror` on expiry)
- **Drop-in WebSocket API** — extends `WebSocket`, same `onopen`/`onmessage`/`onclose`/`onerror` interface

### What it does NOT provide

- **No heartbeat/ping-pong** — cannot detect zombie connections where TCP stays open but the peer is gone
- **No zombie detection** — relies entirely on browser/OS TCP timeout (can take minutes)
- **No `onreconnect` event** — only `onopen` fires again after reconnect; no way to distinguish initial connect from reconnect without external state
- **No resume handlers** — does not listen for `visibilitychange`, `focus`, `online`, or `pageshow`; won't proactively reconnect when a mobile tab comes back to foreground
- **No message deduplication** — if the server replays messages on reconnect, the client will process duplicates
- **No application-level catch-up** — no concept of sequence numbers, last-seen cursors, or missed-message fetching

## 4. Blockers Found

Two critical blockers were identified for CLI adoption, which was the primary v3 target:

### Auth header incompatibility

The CLI uses Bun's non-standard `Authorization` header on WebSocket upgrade requests (`ConnectionAdapter.ts` lines 46, 178):

```ts
new WebSocket(url, {
  headers: { Authorization: `Bearer ${apiKey}` }
})
```

PartySocket does not support custom headers on the WebSocket constructor. This is a fundamental browser WebSocket API limitation — the `WebSocket` constructor only accepts `url` and `protocols`, not arbitrary headers. PartySocket inherits this constraint.

Adopting PartySocket for the CLI would force a switch from header-based auth to query parameter auth (`?token=xxx`), which:
- Changes the auth contract across all transports
- Exposes tokens in server access logs and URL bars
- Requires coordination with the Worker's auth middleware

### Close code contract

The CLI handles specific WebSocket close codes with distinct behaviors:

| Code | Meaning | CLI behavior |
|------|---------|-------------|
| `1000` | Clean close | Don't reconnect |
| `4040` | Room not found | Don't reconnect, show error |
| `1006` | Abnormal (network drop) | Reconnect with backoff |
| `1012` | Service restart | Reconnect immediately |
| `1013` | Try again later | Reconnect with backoff |

PartySocket's reconnect logic runs inside its internal `onclose` handler **before** the user's `onclose` callback fires. There is no mechanism to suppress reconnection based on the close code. A `4040` (room deleted) would cause PartySocket to spin reconnect attempts forever, and a `1000` (clean shutdown) would also trigger unwanted reconnection.

## 5. Value Assessment

### PartySocket for browser lobby

**Marginal value.** Would replace ~20 lines of reconnect code in `useLobbyWebSocket.ts`. The lobby hook is simple enough (107 lines total) that the dependency overhead — bundle size, API surface, version management — isn't justified for such a small win.

### PartySocket for room chat

**Not worth it.** `useRoomWebSocket.ts` already has production-grade transport with heartbeat, zombie detection, resume handlers, seq tracking, and catchUp. PartySocket doesn't handle any of these hard parts. We'd still need all 400 lines of custom logic; PartySocket would only replace the ~30 lines of basic reconnect.

### PartySocket for CLI

**Blocked.** Auth header incompatibility and close code contract issues are real compatibility blockers, not just nice-to-haves. The CLI's transport behavior is correct and intentional.

### PartyServer for backend DOs

**Potential future value**, but a separate refactor decision. Migrating ChatRoom/Lobby/CanvasRoom to extend PartyServer would:
- Align with Cloudflare's Agents SDK inheritance chain
- Get lifecycle helpers (onConnect, onMessage, onClose, onError with typed params)
- Enable use of partysub for cross-DO pub/sub

However, this is a significant backend refactor, not a free upgrade. Our DOs have custom storage patterns, Hono facades, and D1 integration that don't map cleanly to PartyServer's opinionated lifecycle.

### Net code reduction

Estimated ~50-70 lines per transport in reconnect boilerplate. But all the complex code — heartbeat, zombie detection, seq tracking, catchUp, resume handlers, close code routing — stays regardless. The lines PartySocket replaces are the easy ones.

## 6. Decision

**Postponed.** The investigation concluded that:

1. The safe immediate pilot (lobby-only) was smaller than initially expected — marginal value for dependency cost
2. The CLI — the primary v3 target — has real compatibility blockers (auth headers, close codes)
3. The room chat transport already exceeds PartySocket's capabilities
4. Backend PartyServer migration is a separate, larger decision

Current hand-rolled transports are production-grade where it matters (room chat, CLI). The lobby hook could be improved but doesn't need a library to do it.

### Revisit conditions

Will reconsider PartySocket adoption when any of:
- PartySocket adds custom header support for the WebSocket constructor
- We decide to switch CLI auth from headers to query parameter tokens
- We're ready for a larger PartyServer backend migration (which would make the client-side adoption more natural)
- A fourth transport is needed and the reconnect boilerplate becomes genuinely repetitive

## 7. References

- PartyKit repository: https://github.com/cloudflare/partykit
- PartySocket API docs: https://docs.partykit.io/reference/partysocket-api/
- PartyServer README: https://github.com/cloudflare/partykit/tree/main/packages/partyserver
- Cloudflare acquisition announcement: https://blog.cloudflare.com/cloudflare-acquires-partykit/
- partysync (experimental): https://github.com/cloudflare/partykit/tree/main/packages/partysync
- Existing API versioning strategy: [docs/research/08-api-versioning-strategy.md](08-api-versioning-strategy.md)
