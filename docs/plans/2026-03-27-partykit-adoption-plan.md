> **Status: POSTPONED**
>
> This plan was postponed on 2026-03-27 due to two CLI blockers found during review:
> 1. **Auth header incompatibility** — CLI uses `Authorization` header on WS upgrade; PartySocket doesn't support custom headers (browser WebSocket API limitation). Would force a switch to `?token=` query auth.
> 2. **Close code contract** — CLI handles specific close codes (1000, 4040, 1006/1012/1013) to decide reconnect behavior. PartySocket reconnects inside its internal `onclose` before the user callback fires, making it impossible to suppress reconnect on `4040` (room not found).
>
> See [docs/research/2026-03-27-partykit-research.md](../research/2026-03-27-partykit-research.md) for the full investigation.

# Phase 1: PartySocket Adoption — Low-Risk Transport Pilot

## Context

Meet AI has three hand-rolled WebSocket transports with varying robustness:
- **`useRoomWebSocket.ts`** (407 lines) — production-grade: heartbeat, zombie detection, exponential backoff, resume handlers, seq tracking, catchUp
- **CLI `ConnectionAdapter.ts`** (263 lines) — production-grade: exponential backoff with jitter, heartbeat, dedup, catch-up, close code handling
- **`useLobbyWebSocket.ts`** (107 lines) — prototype-grade: fixed 3s reconnect delay, no heartbeat, no dedup, no catch-up, no timeout handling

PartySocket (`partysocket` npm package) is a drop-in WebSocket replacement with auto-reconnect, exponential backoff, and message buffering. It connects to any standard WebSocket endpoint — no PartyServer required on the backend.

**Goal:** Adopt PartySocket as the transport layer in the two pilot targets (CLI v3, lobby browser hook), proving it works with our existing DO endpoints before considering broader adoption. This is a side-update — old clients keep working unchanged.

## What PartySocket Handles

- Auto-reconnect with configurable exponential backoff
- Message buffering (queues `.send()` while disconnected, drains on reconnect)
- Connection timeout
- Standard WebSocket API (`.send()`, `.close()`, `.readyState`, events)

## What PartySocket Does NOT Handle

- Heartbeat / ping-pong
- Zombie connection detection
- `onreconnect` event (only `onopen` fires again)
- Window resume handlers (visibilitychange, focus, online, pageshow)
- Message deduplication
- Application-level catch-up

## Plan

### Step 1: Add `partysocket` dependency

**File:** `packages/cli/package.json`

```bash
cd packages/cli && bun add -E partysocket
```

Also add to `packages/worker/package.json` for the lobby hook:
```bash
cd packages/worker && bun add -E partysocket
```

### Step 2: Pilot in CLI `ConnectionAdapter.ts` — room listen

**File:** `packages/cli/src/domain/adapters/ConnectionAdapter.ts:21-164`

Replace the manual WebSocket + reconnect logic in `listen()`:

**Before:** `new WebSocket(url)` + manual exponential backoff (lines 44-55) + `scheduleReconnect()` + timeout handling

**After:**
```typescript
import PartySocket from 'partysocket'

const ws = new PartySocket({
  url: () => `${wsUrl}/api/rooms/${roomId}/ws?client=cli`,
  // Match current backoff: 1s min, 15s max, 2x growth + jitter
  minReconnectionDelay: 1000,
  maxReconnectionDelay: 15000,
  reconnectionDelayGrowFactor: 2,
  connectionTimeout: 30000,
})
```

**Keep unchanged:**
- Heartbeat ping (30s interval) — lines 76-81
- Message deduplication (Set of 200 IDs) — lines 27-38
- Catch-up HTTP refetch on reconnect — lines 83-97
- Close code handling (1000, 4040, 1006/1012/1013) — lines 129-154
- All event routing and callbacks

**Delete:**
- Manual `attempt` counter and backoff calculation (lines 44-55)
- Manual `scheduleReconnect()` function
- Manual timeout with code 4000 (lines 58-68)
- `reconnectTimer` management

### Step 3: Pilot in CLI `ConnectionAdapter.ts` — lobby listen

**File:** `packages/cli/src/domain/adapters/ConnectionAdapter.ts:166-258`

Same pattern as Step 2 for `listenLobby()`:

**Replace:** `new WebSocket(url)` + manual backoff + `scheduleReconnect()`

**After:**
```typescript
const ws = new PartySocket({
  url: () => `${wsUrl}/api/lobby/ws`,
  minReconnectionDelay: 1000,
  maxReconnectionDelay: 15000,
  reconnectionDelayGrowFactor: 2,
  connectionTimeout: 30000,
})
```

**Keep:** Heartbeat, event routing, callbacks. **Delete:** Manual backoff/reconnect logic.

### Step 4: Pilot in browser `useLobbyWebSocket.ts`

**File:** `packages/worker/src/app/hooks/useLobbyWebSocket.ts`

This hook has the weakest reconnection (fixed 3s delay). PartySocket is a significant upgrade here.

**Replace:** `new WebSocket(url)` + fixed 3s reconnect timeout (lines 78-82)

**After:**
```typescript
import PartySocket from 'partysocket'

const ws = new PartySocket({
  url: () => `${protocol}//${location.host}/api/lobby/ws?token=${encodeURIComponent(key)}`,
  minReconnectionDelay: 1000,
  maxReconnectionDelay: 30000,
  reconnectionDelayGrowFactor: 2,
})
```

**Keep:** All TanStack Query cache updates, Zod event parsing, router navigation, send method, pendingSpawnRef logic.

**Delete:** Fixed 3s `setTimeout` reconnect in `onclose`.

## Explicit Non-Goals

- **No changes to `useRoomWebSocket.ts`** — the room chat hook stays as-is. It has production-grade heartbeat, zombie detection, and resume handlers that PartySocket doesn't replace.
- **No backend DO changes** — PartySocket connects to existing `/api/rooms/:id/ws` and `/api/lobby/ws` endpoints unchanged.
- **No room versioning** — old and new clients coexist on the same endpoints.

## Files Modified

1. `packages/cli/package.json` — add `partysocket` dependency
2. `packages/worker/package.json` — add `partysocket` dependency
3. `packages/cli/src/domain/adapters/ConnectionAdapter.ts` — swap WebSocket constructor + delete manual backoff in both `listen()` and `listenLobby()`
4. `packages/worker/src/app/hooks/useLobbyWebSocket.ts` — swap WebSocket constructor + delete fixed 3s reconnect

## Re-evaluation Gate

After this pilot ships, assess:
- Does PartySocket reconnection work reliably in CLI and lobby?
- Any edge cases with our auth token URLs?
- Is the dependency worth the ~40 lines saved per transport?

Only then consider adopting for `useRoomWebSocket.ts` or moving to PartyServer on the backend.

## Verification

1. `bun run typecheck` — must pass
2. `bun run lint` — no new issues
3. **CLI test:** `meet-ai listen <roomId>` — verify connects, receives messages, reconnects on network drop
4. **CLI lobby test:** `meet-ai listen --lobby` — verify room events stream correctly
5. **Browser lobby test:** Open lobby page, verify room list updates in real-time, reconnects after network toggle
6. **Backward compatibility:** Old CLI versions (v2) still connect to same endpoints — no breakage
7. Existing tests: `bun run test` should still pass
