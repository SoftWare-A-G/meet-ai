# WS Ticket Auth Plan

## Status

Reference document only. No implementation is included in this document.

## Goal

Replace long-lived API keys in browser WebSocket query strings with short-lived HMAC-signed tickets for browser WebSocket connections, while keeping API keys for HTTP requests and CLI auth unchanged.

## Context

Meet AI currently passes long-lived API keys in browser WebSocket query strings (`?token=mai_...`). This exposes credentials in browser-visible URLs and any surrounding logging or tracing surface.

The current system has an important boundary:

1. The Worker is the auth boundary.
2. Durable Objects trust requests forwarded by the Worker.
3. Browser WebSocket clients cannot set custom `Authorization` headers.
4. CLI connections already use `Authorization: Bearer ...` headers and do not need tickets.

This plan targets browser WebSocket flows only:

- room WebSocket
- lobby WebSocket
- canvas WebSocket

HTTP auth, CLI auth, hook auth, and agent auth remain API-key based.

## Proposed Design

### Ticket Model

Use stateless HMAC-signed tickets with a short TTL.

- Ticket transport: `?ticket=<ticket>`
- Ticket TTL: 15-30 seconds
- Fresh ticket required for every connect or reconnect attempt
- No replay store in the initial rollout
- No D1 schema changes

### Payload

The payload should be structured and explicit rather than ad hoc string concatenation.

Suggested fields:

```json
{
  "keyId": "key_123",
  "roomId": "room_123",
  "scope": "room_ws",
  "exp": 1742520000000
}
```

Notes:

- Use absolute `exp`, not relative timestamp math at verification time.
- Scope should distinguish room, lobby, and canvas tickets if those flows share utilities.
- Lobby tickets should either omit `roomId` entirely or use a dedicated payload contract such as `{ keyId, scope: "lobby_ws", exp }`; do not force a fake room identifier into the lobby flow.
- The signature protects the payload, including `exp`.

### Signing Format

Use a compact signed payload:

```text
base64url(payload).base64url(signature)
```

Where:

- `payload` is serialized JSON
- `signature` is HMAC-SHA256 over the raw payload bytes

### Verification Rules

On WebSocket upgrade:

1. Parse ticket into payload and signature
2. Recompute HMAC and compare in constant time
3. Parse payload JSON
4. Check `exp > Date.now()`
5. Check `roomId` and `scope` match the requested route
6. Treat the request as authenticated for the remainder of the route flow

This is stateless verification. It prevents tampering and limits replay to the short TTL window.

Implementation note:

- do not use plain `===` string comparison for signatures
- use a constant-time byte comparison after decoding the provided and expected signatures

## Route Strategy

Do not broaden generic HTTP auth middleware with ticket parsing unless there is a clear cross-protocol need. Ticket verification should stay WS-route-specific in the first implementation.

Reason:

- the problem being solved is browser WebSocket auth
- CLI and HTTP flows already have a good auth path
- adding `?ticket=` handling to global auth middleware unnecessarily widens the auth surface

Preferred structure:

- keep existing API-key auth middleware for HTTP and CLI paths
- add a dedicated WS ticket verifier for browser WebSocket routes

## Files Likely to Change

### New: `packages/worker/src/lib/ws-tickets.ts`

Responsibility:

- create short-lived tickets
- verify tickets
- define payload schema and TTL constant

Suggested exports:

```ts
export type WsTicketScope = 'room_ws' | 'lobby_ws' | 'canvas_ws'

export async function createWsTicket(input: {
  keyId: string
  roomId: string
  scope: WsTicketScope
  secret: string
}): Promise<{ ticket: string; expiresInMs: number }>

export async function verifyWsTicket(input: {
  ticket: string
  secret: string
  roomId: string
  scope: WsTicketScope
}): Promise<{ keyId: string } | null>
```

### New: ticket issuance endpoints

Likely route surface:

- `POST /api/rooms/:id/ws-ticket`
- `POST /api/lobby/ws-ticket`
- `POST /api/rooms/:id/canvas/ws-ticket`

Responsibility:

- authenticate with existing API-key or future session auth
- validate room access where relevant
- return short-lived signed ticket

Response shape:

```json
{
  "ticket": "<signed-ticket>",
  "expires_in_ms": 30000
}
```

### Modify: WebSocket upgrade routes

Likely files:

- `packages/worker/src/routes/ws.ts`
- `packages/worker/src/routes/lobby.ts`
- `packages/worker/src/routes/canvas.ts`

Responsibility:

- accept `?ticket=...` for browser WebSocket upgrades
- verify the ticket at the Worker layer
- continue forwarding trusted requests into Durable Objects

### Modify: browser WebSocket clients

Likely files:

- `packages/worker/src/app/hooks/useRoomWebSocket.ts`
- `packages/worker/src/app/hooks/useLobbyWebSocket.ts`
- `packages/worker/src/app/components/CanvasView/CanvasView.tsx`

Responsibility:

1. request a fresh ticket before opening a WebSocket
2. connect with `?ticket=...`
3. request a fresh ticket before every reconnect attempt
4. do not fall back to raw API keys in WS URLs after ticket support ships

Failure behavior:

- if ticket fetch fails, retry ticket acquisition using the existing reconnect/backoff path
- surface a connection failure state in the UI if ticket acquisition continues to fail
- do not silently downgrade to `?token=...` in browser WebSocket URLs

### Environment

Add:

- `WS_TICKET_SECRET`

Requirements:

- random high-entropy secret
- configured as a Worker secret
- shared by all routes that issue or verify tickets

Future consideration:

- secret rotation should be planned as a dual-key verification window if this moves beyond a narrow rollout
- the first implementation can start with a single active secret, but the utility shape should avoid making future multi-key verification awkward

## What Does Not Change

- CLI WebSocket auth remains `Authorization: Bearer ...`
- HTTP API auth remains API-key based
- hooks remain API-key based
- Durable Objects remain downstream of Worker auth
- D1 schema remains unchanged in the first rollout

## Rollout Phases

### Phase 1: Utilities and issuance

- add ticket utility module
- add ticket issuance endpoints
- add tests for sign/verify/expiry/tamper rejection

### Phase 2: Browser WebSocket adoption

- update room browser WebSocket flow to fetch ticket before connect
- update lobby browser WebSocket flow to fetch ticket before connect
- update canvas browser WebSocket flow to fetch ticket before connect

### Phase 3: Compatibility window

- keep legacy `?token=` browser WS path temporarily if needed for rollout safety
- instrument and observe ticket-based browser WS stability

### Phase 4: Cleanup

- deprecate browser `?token=` WebSocket auth
- remove raw API keys from browser WebSocket URLs once all supported browser clients use tickets

## Verification Plan

### Unit tests

Add focused coverage for:

- valid ticket verifies
- tampered payload fails verification
- tampered signature fails verification
- expired ticket fails verification
- scope mismatch fails verification
- room mismatch fails verification

### Integration tests

Add Worker-level coverage for:

- authenticated ticket issuance endpoint returns ticket
- room WS accepts valid ticket
- room WS rejects expired or malformed ticket
- canvas WS accepts valid ticket
- lobby WS accepts valid ticket

### Browser validation

Manual checks:

1. open Meet AI web UI
2. confirm room WS URL uses `?ticket=` instead of `?token=`
3. confirm lobby WS URL uses `?ticket=` instead of `?token=`
4. confirm reconnect fetches a new ticket
5. confirm ticket fetch failure retries ticket fetch rather than leaking raw API keys into WS URLs

### Non-regression checks

- CLI still connects via `Authorization` header unchanged
- HTTP endpoints still authenticate via API key unchanged
- Durable Object behavior remains unchanged after Worker verification passes

## Risks and Constraints

### Short-lived replay window

The initial design is stateless, so a leaked ticket can be replayed until expiry. This is acceptable only because:

- TTL is short
- browser reconnect fetches a fresh ticket every time
- this is still materially better than long-lived API keys in WS URLs

If the threat model changes, add replay protection later via `jti` tracking.

### Browser-held primary auth still exists

If the web app still authenticates ticket issuance with API keys, browser-side long-lived API keys still exist for HTTP. The immediate win is narrower:

- remove raw API keys from browser WebSocket URLs
- do not claim this eliminates browser-held API keys entirely

### Worker boundary must remain explicit

The Worker continues to be the auth decision point. Durable Objects should not silently diverge into their own auth rules unless that architecture is intentionally redesigned.

## Summary

The first WS ticket rollout should be:

- browser only
- stateless
- Worker-verified
- short-lived
- route-scoped
- no D1 schema changes

That gives Meet AI the main security win with minimal moving parts and without disturbing the existing CLI or HTTP auth model.
