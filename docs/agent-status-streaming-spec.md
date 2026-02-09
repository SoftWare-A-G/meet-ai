# Agent Status Streaming to Web UI

## Overview

### Problem

When running a Claude Code agent team (orchestrator + sub-agents) via the meet-ai chat room, the human operator has no visibility into what agents are doing between chat messages. The only way to check is to switch tabs to the Claude Code terminal, which defeats the purpose of the web UI.

### Solution

Stream real-time agent status events (working, idle, stuck, tool usage, task progress, heartbeats) from Claude Code agents into the meet-ai web UI. Events flow through the existing ChatRoom Durable Object broadcast mechanism and are persisted in D1 for history. A new CLI command (`meet-ai push-event`) lets agents push structured events, and the web UI renders them in a dedicated status panel alongside the chat.

### Goals

- See which agents are online, working, idle, or stuck — without leaving the web UI
- See real-time activity: what tool an agent is using, what file it's editing, what task it's working on
- Persist events for post-session review
- Minimal new infrastructure: reuse the existing ChatRoom DO broadcast, no new Durable Object

---

## Current Architecture

### ChatRoom Durable Object (`packages/worker/src/durable-objects/chat-room.ts`)

The ChatRoom DO manages WebSocket connections for a single chat room:

- **`/ws`** — Accepts WebSocket upgrade, uses Hibernation API with `setWebSocketAutoResponse` for ping/pong
- **`/broadcast`** — Internal HTTP endpoint called by the Worker; iterates all connected WebSockets and sends the payload
- **Alarm** — Runs every 60s to close stale connections (no pong for 2+ minutes)
- **DO naming** — `idFromName("${keyId}:${roomId}")` — one DO instance per key+room pair

### WebSocket Protocol (current)

Messages broadcast from server to clients are JSON objects with this shape:

```json
{
  "id": "uuid",
  "room_id": "uuid",
  "sender": "agent-name",
  "sender_type": "agent",
  "content": "markdown text",
  "color": "#4CAF50",
  "seq": 42
}
```

The web UI (`chat.html`) receives these via `ws.onmessage`, parses JSON, and renders as chat bubbles. The `type: "pong"` messages are filtered out.

### Message Flow

1. CLI calls `POST /api/rooms/:id/messages` with auth
2. Worker validates room ownership, inserts into D1 `messages` table
3. Worker broadcasts the message to the ChatRoom DO via `POST http://internal/broadcast`
4. DO sends to all connected WebSockets
5. Web UI renders the message

### CLI (`packages/cli`)

- `send-message` — sends a chat message via REST API
- `poll` — fetches messages via REST
- `listen` — opens WebSocket, streams messages, handles reconnection with exponential backoff

### D1 Schema (current tables)

| Table | Purpose |
|-------|---------|
| `api_keys` | API key storage (SHA-256 hashed) |
| `rooms` | Chat rooms, scoped by `key_id` |
| `messages` | Chat messages with `seq` ordering |
| `share_tokens` | One-time auth tokens for mobile access |

---

## Proposed Approach

### Extend Existing Broadcast — No New Durable Object

Agent events will flow through the **same ChatRoom DO broadcast** mechanism as chat messages. This is the simplest path because:

1. WebSocket connections are already established per room
2. The broadcast endpoint already iterates all sockets
3. No additional DO bindings or wrangler config needed
4. Events are scoped to the same key+room as messages

### Discrimination: Messages vs. Events

The web UI currently receives chat messages on the WebSocket. We add a `type` field to distinguish:

```json
// Chat message (existing) — no type field, or type: "message"
{ "id": "...", "sender": "team-lead", "content": "...", "seq": 42 }

// Agent event (new) — has type: "agent_event"
{ "type": "agent_event", "event": { ... } }
```

The web UI's `ws.onmessage` handler checks for `type === "agent_event"` and routes to the status panel instead of the chat.

### Data Flow

```
Agent (Claude Code)
  → meet-ai push-event <roomId> <agent> <event_type> [--data '{}']
    → POST /api/rooms/:id/events (new REST endpoint)
      → D1 insert into agent_events table
      → ChatRoom DO broadcast { type: "agent_event", event: {...} }
        → All connected WebSocket clients
          → Web UI status panel renders update
```

---

## Event Data Model

### Event Types

| Event Type | Trigger | Description |
|-----------|---------|-------------|
| `status_change` | Agent starts/stops/gets stuck | Agent lifecycle state |
| `task_update` | Task status changes | Which task, what status |
| `tool_use` | Agent calls a tool | Tool name, file path, description |
| `heartbeat` | Periodic (every 30-60s) | Agent is alive and working |
| `error` | Agent hits an error | Error message, context |
| `metric` | Periodic or on-demand | Token usage, cost, timing |

### JSON Schema

#### Base Event

```json
{
  "id": "uuid",
  "room_id": "uuid",
  "agent": "researcher",
  "event_type": "status_change",
  "data": { ... },
  "created_at": "2026-02-09T10:30:00Z"
}
```

#### `status_change`

```json
{
  "event_type": "status_change",
  "agent": "researcher",
  "data": {
    "status": "working",
    "detail": "Researching agent status streaming"
  }
}
```

Valid statuses: `"idle"`, `"working"`, `"stuck"`, `"offline"`

#### `task_update`

```json
{
  "event_type": "task_update",
  "agent": "frontend-dev",
  "data": {
    "task_id": "15",
    "subject": "Add QR code share button to chat UI",
    "status": "in_progress",
    "progress": "Implementing QR modal component"
  }
}
```

#### `tool_use`

```json
{
  "event_type": "tool_use",
  "agent": "frontend-dev",
  "data": {
    "tool": "Edit",
    "file": "packages/worker/public/chat.html",
    "description": "Adding share button to header"
  }
}
```

#### `heartbeat`

```json
{
  "event_type": "heartbeat",
  "agent": "researcher",
  "data": {
    "uptime_s": 600,
    "status": "working"
  }
}
```

#### `error`

```json
{
  "event_type": "error",
  "agent": "frontend-dev",
  "data": {
    "message": "Test suite failed: 2 tests failing",
    "context": "Running vitest after editing chat.html"
  }
}
```

#### `metric`

```json
{
  "event_type": "metric",
  "agent": "team-lead",
  "data": {
    "tokens_in": 15000,
    "tokens_out": 3200,
    "cost_usd": 0.12,
    "elapsed_s": 45
  }
}
```

---

## Storage

### D1 Table: `agent_events`

```sql
-- Migration: 0006_agent_events.sql
CREATE TABLE IF NOT EXISTS agent_events (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id),
  agent TEXT NOT NULL,
  event_type TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_agent_events_room ON agent_events(room_id, created_at);
CREATE INDEX idx_agent_events_room_agent ON agent_events(room_id, agent);
CREATE INDEX idx_agent_events_room_type ON agent_events(room_id, event_type);
```

**Notes:**
- `data` is stored as JSON text (D1 does not have a native JSON type)
- The `room_id` foreign key ensures multi-tenant isolation (rooms are already scoped by `key_id`)
- Three indexes support common query patterns: chronological listing, per-agent filtering, per-type filtering
- No `key_id` column needed — room ownership already enforces access control

### Retention / Cleanup

- Events are high-volume — thousands per session
- Recommended: scheduled CRON trigger (Cloudflare Workers Cron) to delete events older than 7 days
- Alternative: `LIMIT` on queries + periodic manual `DELETE FROM agent_events WHERE created_at < datetime('now', '-7 days')`

---

## API Endpoints

### `POST /api/rooms/:id/events` (authed)

Create and broadcast an agent event.

**Request:**
```json
{
  "agent": "researcher",
  "event_type": "status_change",
  "data": { "status": "working", "detail": "Analyzing codebase" }
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "room_id": "uuid",
  "agent": "researcher",
  "event_type": "status_change",
  "data": { "status": "working", "detail": "Analyzing codebase" },
  "created_at": "2026-02-09T10:30:00Z"
}
```

**Logic:**
1. Validate auth (requireAuth middleware)
2. Validate room ownership (same as messages)
3. Validate required fields: `agent`, `event_type`
4. Insert into `agent_events` table
5. Broadcast via ChatRoom DO: `{ type: "agent_event", event: { ... } }`
6. Return the event

**Rate limit:** 120/min per key (double the message rate — events are lightweight)

### `GET /api/rooms/:id/events` (authed)

Fetch event history.

**Query params:**
- `agent` — filter by agent name
- `event_type` — filter by event type
- `since` — ISO timestamp, only events after this time
- `limit` — max results (default 100, max 500)

**Response (200):**
```json
[
  {
    "id": "uuid",
    "room_id": "uuid",
    "agent": "researcher",
    "event_type": "heartbeat",
    "data": { "uptime_s": 600, "status": "working" },
    "created_at": "2026-02-09T10:30:00Z"
  }
]
```

### `GET /api/rooms/:id/agents` (authed)

Get current status of all agents in the room. This is a **computed view** built from the most recent events.

**Response (200):**
```json
{
  "agents": [
    {
      "name": "team-lead",
      "status": "working",
      "last_seen": "2026-02-09T10:30:00Z",
      "current_task": "Coordinating team",
      "connected": true
    },
    {
      "name": "researcher",
      "status": "idle",
      "last_seen": "2026-02-09T10:28:00Z",
      "current_task": null,
      "connected": true
    }
  ]
}
```

**Logic:** Query the most recent `status_change` and `heartbeat` events per agent. An agent with no heartbeat in the last 2 minutes is marked `connected: false`.

---

## CLI Commands

### `meet-ai push-event`

```bash
meet-ai push-event <roomId> <agent> <event_type> [--data '{"key":"value"}'] [--color "#2196F3"]
```

**Examples:**

```bash
# Status change
meet-ai push-event abc-123 researcher status_change --data '{"status":"working","detail":"Analyzing codebase"}'

# Task update
meet-ai push-event abc-123 frontend-dev task_update --data '{"task_id":"15","subject":"Add QR button","status":"in_progress"}'

# Heartbeat
meet-ai push-event abc-123 researcher heartbeat --data '{"uptime_s":300,"status":"working"}'

# Error
meet-ai push-event abc-123 frontend-dev error --data '{"message":"Tests failing"}'

# Tool use
meet-ai push-event abc-123 researcher tool_use --data '{"tool":"Read","file":"src/index.ts"}'
```

**Implementation:** Add a new `case "push-event"` to `packages/cli/src/index.ts` that calls `POST /api/rooms/:id/events`.

### Auto-Heartbeat in `listen`

Extend the existing `listen` command to automatically send heartbeat events:

```bash
meet-ai listen abc-123 --heartbeat --agent researcher
```

When `--heartbeat` and `--agent` flags are provided, the `listen` command sends a `heartbeat` event every 30 seconds via the REST API. This integrates naturally with the existing WebSocket connection and provides "is alive" signals without manual push-event calls.

**Implementation:** Add a `setInterval` in the `listen` case that calls `POST /api/rooms/:id/events` with `event_type: "heartbeat"`.

---

## Web UI Design

### Status Bar (top of chat area)

A compact bar below the room header showing connected agents with color-coded status indicators:

```
+-------------------------------------------------------------------+
| # dogfooding-session                              [Share] [Events] |
+-------------------------------------------------------------------+
| Agents: ● team-lead (working)  ● researcher (idle)  ● frontend-dev (working) |
+-------------------------------------------------------------------+
```

- Green dot: `working`
- Yellow dot: `idle`
- Red dot: `stuck` or `error`
- Gray dot: `offline` (no heartbeat for 2+ min)
- Clicking an agent name scrolls to their latest activity in the events panel

### Activity Panel (collapsible sidebar or drawer)

A toggleable panel (opened via `[Events]` button) showing a timeline of recent events:

```
+----------------------------+
| Agent Activity        [x]  |
+----------------------------+
| 10:30  researcher          |
|   ● Working: Analyzing     |
|     codebase               |
|                            |
| 10:29  frontend-dev        |
|   ▶ Edit: chat.html        |
|   "Adding share button"    |
|                            |
| 10:28  frontend-dev        |
|   ◆ Task #15 in_progress   |
|   "Add QR code button"     |
|                            |
| 10:25  team-lead           |
|   ✓ Task #14 completed     |
|                            |
| 10:22  researcher          |
|   ⚠ Error: SSH push failed |
+----------------------------+
```

- Events are grouped by time and agent
- Color-coded by agent (same as chat message colors)
- Heartbeats are hidden by default (they just update the status bar dots)
- Errors are highlighted in red
- Panel auto-scrolls to latest

### Inline Events (in chat stream)

Major events (status changes, errors, task completions) can optionally appear inline in the chat as small system messages:

```
─── researcher is now working: Analyzing codebase ───
─── frontend-dev completed Task #15: Add QR code button ───
─── frontend-dev error: Tests failing ───
```

These use a distinct visual style (centered, muted text, no avatar) to differentiate from chat messages.

---

## Implementation Phases

### Phase 1: Backend Foundation

**Goal:** D1 storage + REST API + broadcast

1. Create migration `0006_agent_events.sql` with the schema above
2. Add `agent_events` queries to `packages/worker/src/db/queries.ts`
3. Create `packages/worker/src/routes/events.ts` with `POST` and `GET` endpoints
4. Register routes in `packages/worker/src/index.ts`
5. Broadcast events through the existing ChatRoom DO
6. Add tests for event creation, retrieval, filtering, and auth

**Estimated scope:** ~150 lines of new Worker code + migration + tests

### Phase 2: CLI Support

**Goal:** Agents can push events from the terminal

1. Add `pushEvent` method to `packages/cli/src/client.ts`
2. Add `push-event` command to `packages/cli/src/index.ts`
3. Add `--heartbeat` and `--agent` flags to `listen` command
4. Publish new CLI version

**Estimated scope:** ~60 lines of CLI code

### Phase 3: Web UI — Status Bar

**Goal:** See agent status at a glance

1. Add status bar HTML/CSS below the room header in `chat.html`
2. On room select, fetch `GET /api/rooms/:id/agents` to populate initial state
3. Listen for `type: "agent_event"` on the WebSocket and update dots in real-time
4. Handle heartbeat timeout (gray out agents with no heartbeat for 2+ min)

**Estimated scope:** ~80 lines of HTML/CSS/JS in `chat.html`

### Phase 4: Web UI — Activity Panel

**Goal:** See detailed event timeline

1. Add collapsible panel HTML/CSS (slide-out drawer or right sidebar)
2. On open, fetch `GET /api/rooms/:id/events?limit=100`
3. Stream new events from WebSocket into the panel
4. Render events with icons, colors, and timestamps
5. Filter controls: by agent, by event type

**Estimated scope:** ~120 lines of HTML/CSS/JS in `chat.html`

### Phase 5: Polish and Optimization

**Goal:** Production-ready

1. Add inline event rendering in the chat stream (optional, configurable)
2. Add CRON trigger for event retention cleanup (7-day TTL)
3. Rate limiting for event endpoint (120/min)
4. Add event count badge to the `[Events]` button
5. Mobile-responsive layout for the status bar and activity panel

**Estimated scope:** ~70 lines

---

## Open Questions

### Rate Limiting

- **Current plan:** 120/min per API key for events (2x the message rate)
- **Concern:** With auto-heartbeat every 30s and 5 agents, that's 10 events/min just for heartbeats. Tool use events could spike to 20+/min per agent during active coding. 120/min should be sufficient but should be monitored.
- **Alternative:** Separate rate limit bucket for events vs. messages

### Retention / TTL

- **Current plan:** 7-day retention via CRON cleanup
- **Question:** Should events be purged more aggressively? They're not as valuable as chat messages long-term.
- **Alternative:** 24-hour retention for heartbeats, 7-day for status changes / errors / task updates

### Disconnect Detection

- **Current plan:** No heartbeat for 2 minutes = agent shown as offline/gray
- **Question:** Is 2 minutes the right threshold? The ChatRoom DO already has a 2-minute stale timeout for WebSocket cleanup.
- **Alternative:** Shorter threshold (60s) since agents should heartbeat every 30s
- **Note:** Disconnect detection is client-side in the web UI (comparing `last_seen` to `Date.now()`)

### Event Batching

- **Question:** Should the CLI batch multiple events into a single API call?
- **Pro:** Reduces HTTP overhead when an agent is very active
- **Con:** Adds complexity, delays real-time visibility
- **Recommendation:** Start with individual events. Batch later if rate limiting becomes an issue.

### WebSocket Event Filtering

- **Question:** Should the server filter events per-client (e.g., only send heartbeats to clients that requested them)?
- **Current plan:** Broadcast all events to all clients; UI filters client-side
- **Trade-off:** Server-side filtering reduces bandwidth but adds DO complexity

### Event Deduplication

- **Question:** How to handle duplicate events from CLI retries?
- **Current plan:** Events have UUIDs; the web UI's existing dedup Set (capped at 200) covers this
- **Enhancement:** Server-side idempotency key for `push-event` (optional)

### Separate DO vs. Shared Broadcast

- **Decision:** Reuse existing ChatRoom DO broadcast (no new DO)
- **Rationale:** Events are room-scoped just like messages. Adding a new DO would require new bindings, new WebSocket connections from the web UI, and duplicate auth logic — all for no functional benefit.
- **Trade-off:** High event volume could slow down message broadcast. Mitigation: events are small JSON payloads (<500 bytes), and the DO broadcast loop is fast (~1ms per socket).
