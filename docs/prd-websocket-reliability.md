# PRD: WebSocket Reliability & Message Sync

**Status:** Proposed
**Authors:** backend-dev, ws-dev, cf-expert, bun-expert, cli-expert (AI agent team)
**Date:** 2026-02-07

## Problem

The meet-ai orchestrator agent misses chat messages when its WebSocket connection drops. The current implementation has:
- No catch-up mechanism on reconnect — messages during the disconnect window are permanently lost
- Flat 2s reconnect delay — causes thundering herd on deploys/DO evictions
- Application-level ping/pong that wakes the Durable Object unnecessarily
- No signal handling — agents die ungracefully
- No gap detection — clients can't tell if they missed messages

## Approach Comparison

| Approach | Latency | Message Loss Risk | Server Changes | Client Changes | Complexity | Recommendation |
|----------|---------|-------------------|----------------|----------------|------------|----------------|
| **WS + REST catch-up** | ~instant + 1 RTT on reconnect | None (D1 is source of truth) | Seq column migration | ~60-80 lines in client.ts | Low | **Do this** |
| **WS + REST catch-up (UUID only)** | ~instant + 1 RTT | None | Zero | ~40 lines | Very Low | Acceptable MVP |
| **DO-based replay (durable streams)** | ~instant | None | DO storage writes, new WS protocol | Medium | Medium-High | Defer |
| **Long-polling fallback** | Up to timeout_ms | None (built-in gap recovery) | New endpoint with hold semantics | New `--mode longpoll` flag | Medium | Defer (fallback only) |
| **SSE** | ~instant | Needs custom recovery | Separate delivery path | New client code | Medium | Not recommended |

### Verdict: WebSocket + REST Catch-Up with Sequence Numbers

All 5 agents independently converged on this approach. It leverages the existing D1 storage as source of truth, requires minimal server changes, and makes the system self-healing regardless of what causes the WebSocket interruption (deploys, DO relocation, network drops, hibernation).

## Solution: Phased Implementation

### Phase 1 — Critical Reliability (P0) ✅ DONE

**1.1 REST catch-up on reconnect (client.ts)**

Track last-seen message ID. On WebSocket reconnect, fetch missed messages via existing `GET /api/rooms/:id/messages?after=<id>` before resuming the WS stream.

```ts
let lastSeenId: string | null = null;

ws.onopen = async () => {
  reconnectAttempt = 0;
  if (lastSeenId) {
    const missed = await getMessages(roomId, { after: lastSeenId, exclude });
    for (const msg of missed) {
      deliver(msg);
    }
  }
};

ws.onmessage = (event) => {
  const msg = parse(event.data);
  deliver(msg);
};

function deliver(msg) {
  if (seen.has(msg.id)) return;
  seen.add(msg.id);
  lastSeenId = msg.id;
  onMessage(msg);
}
```

**1.2 Client-side deduplication**

Maintain a `Set<string>` of recent message IDs (cap at ~200) to handle overlap between REST catch-up and WS delivery.

**1.3 Exponential backoff + jitter (client.ts)**

Replace flat 2s delay with exponential backoff (1s base, 30s cap) plus random jitter to prevent thundering herd on mass reconnect.

```ts
let reconnectAttempt = 0;
function getReconnectDelay() {
  const delay = Math.min(1000 * 2 ** Math.min(reconnectAttempt, 5), 30_000);
  reconnectAttempt++;
  return delay + delay * 0.5 * Math.random();
}
```

**1.4 setWebSocketAutoResponse (chat-room.ts)**

Enable CF edge-level ping/pong so the DO doesn't wake for keep-alive:

```ts
this.ctx.setWebSocketAutoResponse(
  new WebSocketRequestResponsePair(
    JSON.stringify({ type: 'ping' }),
    JSON.stringify({ type: 'pong' })
  )
);
```

Remove the manual ping handler from `webSocketMessage()`.

**Estimated diff:** ~80 lines across client.ts + chat-room.ts.

### Phase 2 — Robustness (P1) ✅ DONE

**2.1 Sequence numbers on messages**

DB migration:
```sql
ALTER TABLE messages ADD COLUMN seq INTEGER;
CREATE INDEX idx_messages_room_seq ON messages(room_id, seq);
```

Insert with auto-increment per room:
```sql
INSERT INTO messages (id, room_id, sender, content, seq)
VALUES (?, ?, ?, ?, COALESCE((SELECT MAX(seq) FROM messages WHERE room_id = ?), 0) + 1)
```

Benefits over UUID-based catch-up:
- Gap detection from WS stream alone (seq 42 → seq 45 = missed 2)
- Cheaper DB queries (`WHERE seq > N` vs rowid subquery)
- Clean pagination (`?since_seq=N&limit=100`)

**2.2 Close code handling (client.ts)**

Differentiate between network drops (1006), normal closes (1000), service restarts (1012), and back-off signals (1013).

**2.3 Connection timeout (client.ts)**

Bun's WebSocket has no connection timeout — add a 10s wrapper to prevent 75s TCP hangs on unreachable servers.

**2.4 Graceful shutdown with signal handling**

Handle SIGINT/SIGTERM to send a clean WebSocket close frame before process exit.

**2.5 Binary message safety**

Handle potential `ArrayBuffer` from Bun's WS: `typeof event.data === 'string' ? event.data : new TextDecoder().decode(event.data)`.

### Phase 3 — Observability (P2) ✅ DONE

**3.1 Stderr lifecycle events**

Emit structured JSON on stderr for connection state changes:
```
{"event":"connected", "ts":"..."}
{"event":"disconnected", "code":1006, "ts":"..."}
{"event":"reconnecting", "attempt":1, "delay_ms":1000, "ts":"..."}
{"event":"reconnected", "catchup_count":3, "ts":"..."}
```

**3.2 Alarm-based stale connection cleanup (chat-room.ts)**

Use DO alarm API to periodically check `getWebSocketAutoResponseTimestamp()` and close connections that haven't responded to pings in 120s.

**3.3 Broadcast failure logging**

Change the `/broadcast` call from fire-and-forget to checked, log failures. Message is already in D1 so clients recover on next poll/reconnect.

### Deferred

- **DO-based replay (durable streams):** Over-engineered for <100 connections per room. D1 + REST catch-up is simpler and sufficient.
- **Long-polling fallback:** Only needed if WebSocket is blocked in certain environments. Implement if a concrete need arises.
- **SSE:** Adds architectural complexity without meaningful benefit over WS + REST catch-up.
- **Server-side delivery tracking:** Per-client ack tracking in DO. Overkill for current agent team use case.
- **Cursor file persistence:** Local file to persist lastSeenId across process restarts. Defer unless real need emerges.

## CF Platform Constraints (from cf-expert)

1. **Deploy = disconnect all.** Every `wrangler deploy` drops all WebSocket connections.
2. **DO relocation.** CF may move a DO to a different datacenter. All connections drop.
3. **waitUntil is best-effort.** If Worker isolate is evicted before completion, broadcast never fires.
4. **No WebSocket backpressure API.** Slow clients cause memory pressure → DO drops connection.
5. **Constructor runs on every wake.** Keep it lightweight.
6. **D1 serializes writes.** Seq number INSERT with MAX subquery is race-condition-safe.
7. **Edge idle timeout ~100s.** Ping interval must be well under this (20-30s recommended).

## Files Changed

| File | Changes |
|------|---------|
| `packages/cli/src/client.ts` | Catch-up on reconnect, dedup, backoff, timeout, signal handling, binary safety |
| `packages/worker/src/durable-objects/chat-room.ts` | setWebSocketAutoResponse, remove manual ping, alarm cleanup |
| `packages/worker/src/db/queries.ts` | listMessagesSinceSeq function |
| `packages/worker/src/routes/rooms.ts` | since_seq query param, broadcast error handling |
| `packages/worker/migrations/` | Add seq column + index |
| `packages/cli/src/index.ts` | Capture listen return value, signal handlers |
| `.claude/skills/meet-ai-team-chat/SKILL.md` | Clarify listen vs poll roles |

## Success Metrics

- Zero missed messages during WebSocket reconnections
- Reconnect + catch-up completes in < 2 seconds
- DO billable duration reduced by ~90% for idle rooms (via auto-response)
- No thundering herd on deploy (jittered reconnect)
