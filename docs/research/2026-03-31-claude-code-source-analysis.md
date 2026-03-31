# Claude Code Source Code Analysis for Meet-AI

**Date:** 2026-03-31
**Source:** `/Users/isnifer/Downloads/cc-source/` (CC internal source, ~800K+ lines TypeScript)

## Purpose

Analyze Claude Code's architecture to identify patterns, APIs, and integration points
that can improve meet-ai's multi-agent chat room platform.

---

## 1. WebSocket Resilience Patterns

CC's bridge system has battle-tested WebSocket patterns meet-ai's Durable Objects layer needs.

### Message Deduplication

CC uses a `BoundedUUIDSet` (ring buffer ~100 entries) to prevent:
- **Echo rendering** — messages we sent being shown back to us on broadcast
- **Re-delivery rendering** — same message re-delivered on reconnect

Meet-ai currently has no dedup. If a client reconnects during a broadcast, it can see duplicates.

### Sequence Number Tracking

CC's v2 transport (SSE) tracks `lastEventId` so reconnecting clients request only unseen messages.
This is exactly what meet-ai needs for long-running agent sessions where disconnects are common.

### Reconnection Strategy

- Exponential backoff: 2s -> 4s -> 8s -> 16s -> 32s (max 5 attempts)
- Proactive JWT refresh: 5 minutes before expiry
- Keep-alive via ping/pong heartbeat (30s interval)

### Two Transport Protocols

| Protocol | Read | Write | Use Case |
|----------|------|-------|----------|
| v1 (WebSocket) | Bidirectional WS | Same WS | Simple, low-latency |
| v2 (SSE + HTTP) | SSE stream | HTTP POST | Decoupled, resumable |

**Actionable for meet-ai:** Add `seq` field to WebSocket broadcast messages. Add `BoundedUUIDSet` for client-side dedup in the DO.

---

## 2. Hook System Architecture

CC has 26 hook event types and 5 hook execution types. Meet-ai has 3 hooks (log-tool-use, plan-review, question-review), all command-type only.

### Hook Types

| Type | Execution | Timeout | Example |
|------|-----------|---------|---------|
| `command` | Shell script (bash/powershell) | 10 min | Current meet-ai hooks |
| `prompt` | Single LLM query (Haiku) | 30s | Quick validation |
| `agent` | Multi-turn agent (up to 50 turns) | 60s | Complex verification |
| `http` | POST to URL with JSON body | 10 min | **No CLI dependency!** |
| `function` | In-memory TS callback | 5s | Session-scoped |

### Hook Event Types (26 total)

**Tool execution:** PreToolUse, PostToolUse, PostToolUseFailure, PermissionDenied, PermissionRequest
**Session:** UserPromptSubmit, SessionStart, SessionEnd, Stop, StopFailure
**Setup:** Setup, ConfigChange, CwdChanged, FileChanged
**Agent/Workflow:** SubagentStart, SubagentStop, PreCompact, PostCompact, TeammateIdle, TaskCreated, TaskCompleted
**Elicitation:** Elicitation, ElicitationResult
**Other:** InstructionsLoaded, WorktreeCreate, WorktreeRemove, Notification

### Async Hook Protocol

Hooks can return `{"async": true, "asyncTimeout": 15000}` as first stdout line.
CC backgrounds the process and polls via `AsyncHookRegistry` each turn.
Progress events stream every 1s for long-running hooks.

### Exit Code Semantics

- `0` — Success
- `1` — Soft error (show to user, continue)
- `2` — Blocking error (show to model, block action)

### Hook Output Shape

```json
{
  "continue": true,
  "decision": "approve|block",
  "reason": "string",
  "hookSpecificOutput": {
    "permissionDecision": "allow|deny|ask",
    "updatedInput": {},
    "additionalContext": "string"
  }
}
```

**Actionable for meet-ai:**
- Add HTTP hook type (simplest win — no CLI dependency for hooks)
- Add SubagentStart/SubagentStop events for richer chat room visibility
- Consider async hook pattern for plan-review (replace custom polling loop)

---

## 3. Swarm/Team Coordination

CC's multi-agent system runs in 3 modes: in-process (AsyncLocalStorage), tmux panes, iTerm2 panes.

### File-Based Mailbox

Path: `~/.claude/teams/{team_name}/inboxes/{agent_name}.json`

```typescript
type TeammateMessage = {
  from: string
  text: string
  timestamp: string
  read: boolean
  color?: string
  summary?: string  // 5-10 word preview
}
```

- File-locking for concurrent writes
- Polled every 1000ms by `useInboxPoller`
- Messages formatted as `<teammate_message>` XML and submitted as user turns

### Permission Delegation

```typescript
type PermissionRequest = {
  id: string
  workerId: string         // agent@team
  toolName: string
  input: Record<string, unknown>
  status: 'pending' | 'approved' | 'rejected'
  resolvedBy?: 'worker' | 'leader'
  feedback?: string
  updatedInput?: Record<string, unknown>
  permissionUpdates?: PermissionUpdate[]
}
```

Two mechanisms:
1. **In-process bridge** — direct function calls via closure (lowest latency)
2. **Mailbox** — file-based, works cross-process (fallback)

### Leader/Worker Pattern

- Leaders coordinate via AgentTool spawning
- Workers execute autonomously, report via task notifications
- `waitForTeammatesToBecomeIdle()` uses callbacks, not polling
- UI transcripts capped at 50 messages (memory optimization)

**Actionable for meet-ai:**
- Adopt PermissionRequest schema for unified plan-review + question-review
- Add message capping in DO for long-running rooms
- Consider callback-based idle detection instead of polling

---

## 4. Task State Machine

### States

```
pending -> running -> (completed | failed | killed)
```

### Task Types

| Type | Description |
|------|-------------|
| `local_bash` | Shell commands |
| `local_agent` | In-process subagents |
| `remote_agent` | Cloud-run sessions |
| `in_process_teammate` | Swarm agents |
| `local_workflow` | Workflow scripts |
| `monitor_mcp` | MCP server monitoring |
| `dream` | Auto-consolidation/memory |

### Disk-Backed Output

- `getTaskOutputDelta(taskId, fromOffset)` returns only new content since last read
- Output persisted to `~/.claude/tasks/{sessionId}/{taskId}.txt`
- AppState holds only metadata + offset (reduces RAM)
- Terminal tasks evicted after notification + 30s grace period

### Progress Streaming

```typescript
onProgress?: (progress: { toolUseID: string, data: P }) => void
```

Called during tool execution to stream intermediate state.

**Actionable for meet-ai:**
- Add task-like state machine for agent activity in chat rooms
- Use offset-based delta reads for log-tool-use aggregated messages
- Consider eviction for old messages in long-running DO rooms

---

## 5. Tool System Design

### Tool Interface (key properties)

| Property | Purpose |
|----------|---------|
| `call()` | Execute the tool |
| `inputSchema` | Zod validation |
| `isConcurrencySafe()` | Can run in parallel? (default: false — fail-closed) |
| `isReadOnly()` | Non-mutating? (default: false) |
| `shouldDefer` | Lazy-loaded via ToolSearch |
| `searchHint` | 3-10 word capability phrase for search |
| `checkPermissions()` | Permission gate |

### Concurrency Model

- Read-only + concurrency-safe tools: parallel (up to 10)
- All others: serialized
- Context modifiers queued until batch completes
- Fail-closed default prevents race conditions

### ToolSearch (Deferred Loading)

Keyword scoring: exact match (10-12 pts), partial (5-6 pts), searchHint (4 pts), description (2 pts).
Required terms (prefixed `+`) must all match.

**Actionable for meet-ai:** Use CC's scoring algorithm for slash command autocomplete in chat UI.

---

## 6. Memory System

### Four Types

| Type | Scope | Example |
|------|-------|---------|
| `user` | Always private | "Senior Go engineer, new to React" |
| `feedback` | Private or team | "Don't mock the database" |
| `project` | Private or team | "Merge freeze starts March 5" |
| `reference` | Usually team | "Bugs tracked in Linear INGEST" |

### Semantic Search

1. Scan memory dir recursively (frontmatter only, newest-first, cap 200)
2. Format manifest: one line per file with `[type] filename (timestamp): description`
3. Send to Sonnet selector with user query + recent tools
4. Return up to 5 relevant file paths

### Freshness

- `memoryAgeDays(mtimeMs)` — floor-rounded elapsed days
- Memories >1 day old get staleness caveat
- "Before recommending from memory" — verify files/functions still exist

### MEMORY.md Index

- Single index file loaded into system prompt
- Dual cap: 200 lines OR 25KB (whichever fires first)
- One-line entries: `- [Title](file.md) — one-line hook`

---

## 7. Message Injection Mechanisms (CC Session Input)

### All Paths for Sending Messages INTO a Running CC Session

| Mechanism | Cross-Machine | Real-time | Self-Hostable | Security |
|-----------|---|---|---|---|
| **DirectConnect WebSocket** | Yes | Instant | **Yes** | Bearer token |
| **Mailbox (JSON file)** | No | ~1s delay | Yes | Filesystem perms |
| **UDS Socket** | No | Instant | Internal only | Filesystem perms |
| **Bridge WebSocket** | Yes | Instant | No (Anthropic infra) | OAuth |
| **tmux send-keys** | No | Instant | N/A | **INSECURE from remote** |
| **stdin (SDK mode)** | No | Instant | Yes (parent process) | Process boundary |

### DirectConnect WebSocket (RECOMMENDED for meet-ai)

CC's official protocol for external servers to control CC sessions. CC acts as a **client**
connecting to **your** WebSocket server. This is the best path for meet-ai.

**Launch CC in DirectConnect mode:**
```bash
claude -p --sdk-url wss://your-do.workers.dev/ws --input-format stream-json --output-format stream-json
```

**Session lifecycle:**

1. CC POSTs to your server to create a session:
```
POST /sessions
Authorization: Bearer <token>
Content-Type: application/json

{"cwd": "/path/to/project"}
```

Server responds:
```json
{"session_id": "abc123", "ws_url": "wss://your-do.workers.dev/ws/abc123"}
```

2. CC connects to `ws_url` with bearer token in headers.

3. All messages are **NDJSON** (one JSON per line, separated by `\n`).

**Client -> Server (CC sends to meet-ai DO):**

User message:
```json
{"type": "user", "message": {"role": "user", "content": "hello"}, "session_id": "abc123", "uuid": "msg-uuid"}
```

Permission response (allow):
```json
{"type": "control_response", "response": {"subtype": "success", "request_id": "req-uuid", "response": {"behavior": "allow"}}}
```

Permission response (deny):
```json
{"type": "control_response", "response": {"subtype": "success", "request_id": "req-uuid", "response": {"behavior": "deny", "message": "User denied"}}}
```

**Server -> Client (meet-ai DO sends to CC):**

Assistant response:
```json
{"type": "assistant", "message": {"role": "assistant", "content": [...]}, "session_id": "abc123", "uuid": "resp-uuid"}
```

Permission request (tool approval):
```json
{"type": "control_request", "request_id": "req-uuid", "request": {"subtype": "can_use_tool", "tool_name": "Bash", "input": {"command": "npm install"}, "description": "Install deps"}}
```

Turn complete:
```json
{"type": "result", "subtype": "success", "duration_ms": 1234, "total_cost_usd": 0.05, "num_turns": 3}
```

Keep-alive (every 5 min):
```json
{"type": "keep_alive"}
```

Interrupt/cancel:
```json
{"type": "control_request", "request_id": "uuid", "request": {"subtype": "interrupt"}}
```

**Permission flow — the killer feature for meet-ai:**
```
CC wants to run Bash("npm install")
  -> CC sends control_request to DO
  -> DO broadcasts to web UI
  -> User clicks Approve in browser
  -> DO sends control_response back to CC
  -> CC executes the tool
```

**Reconnection (built into CC client):**
- Exponential backoff: 1s -> 2s -> 4s -> ... -> 30s max, +/-25% jitter
- 10-minute time budget before giving up
- UUID-based message replay on reconnect
- Sleep detection: if gap > 60s, reset budget

**WebSocket close codes:**

| Code | Meaning | Retry? |
|------|---------|--------|
| 1000/1001 | Clean close | No |
| 1002 | Protocol error | No |
| 4001 | Session expired | No |
| 4003 | Unauthorized | Yes (refresh token) |

**Key detail:** `--sdk-url` runs CC in print mode (headless, no terminal REPL). The web UI
IS the UI. This is perfect for meet-ai — agents don't need a local terminal when driven
from the chat room.

**Source files:**
- `server/createDirectConnectSession.ts` — HTTP session creation
- `server/directConnectManager.ts` — WebSocket manager + message handling
- `entrypoints/sdk/coreSchemas.ts` — all message type schemas (Zod)
- `entrypoints/sdk/controlSchemas.ts` — control request/response schemas
- `cli/transports/WebSocketTransport.ts` — client-side WS with retry

### UDS (Unix Domain Socket) — Internal Only

Feature-gated behind `UDS_INBOX` (ant-only, dead-code eliminated in public builds).
Implementation files (`udsMessaging.ts`, `udsClient.ts`) stripped from source.

**What we know from call sites:**

Server startup:
```
setup.ts -> startUdsMessaging(socketPath, {isExplicit})
-> listens on auto-generated path or --messaging-socket-path
-> exports CLAUDE_CODE_MESSAGING_SOCKET env var
```

Client send (plain text only):
```typescript
// SendMessageTool.ts
await sendToUdsSocket(socketPath, message)
```

Socket path discovery:
- `CLAUDE_CODE_MESSAGING_SOCKET` env var
- PID files at `~/.claude/sessions/<pid>.json` with `messagingSocketPath`
- SDK init message includes `messaging_socket_path`

In headless mode, incoming UDS messages trigger the query loop immediately (no polling):
```typescript
setOnEnqueue(() => { void run() })
```

**Verdict:** Dead end for meet-ai. Internal-only, implementation stripped. DirectConnect
is the supported external integration path.

### Mailbox System (Current meet-ai Approach)

Write JSON to `~/.claude/teams/{team}/inboxes/{agent}.json`.
Polled every 1000ms by `useInboxPoller`. Messages submitted as user turns.
File-locking for concurrent writes. Works but has 1s latency.

### tmux send-keys — INSECURE FROM REMOTE

```typescript
await runTmux(['send-keys', '-t', paneId, command, 'Enter'])
```

Allows arbitrary text injection into terminal. Equivalent to remote code execution
when triggered from a web UI. **Never use this from remote sources.**

### Recommendation for meet-ai

**DirectConnect is the answer.** Meet-ai's Durable Object becomes the DirectConnect server.
CC sessions connect to it via `--sdk-url`. The DO bridges web UI users and CC sessions
over the same WebSocket room. Permission requests flow through the web UI natively.

```
Browser (web UI)              meet-ai DO                 CC session (headless)
     |                            |                            |
     |                            |  POST /sessions            |
     |                            |<---------------------------|
     |                            |  {session_id, ws_url}      |
     |                            |--------------------------->|
     |                            |                            |
     |                            |  WebSocket connect         |
     |                            |<---------------------------|
     |                            |                            |
     | "Fix the bug"              |                            |
     |---(browser WS)----------->|                            |
     |                            |  {"type":"user",...}       |
     |                            |---(CC WS)---------------->|
     |                            |                            |
     |                            |  {"type":"control_request" |
     |                            |   "tool_name":"Bash"...}   |
     |                            |<--(CC WS)-----------------|
     | [Permission card in UI]    |                            |
     |<--(browser WS)-----------|                            |
     |                            |                            |
     | [User clicks Approve]      |                            |
     |---(browser WS)----------->|                            |
     |                            |  {"type":"control_response"|
     |                            |   "behavior":"allow"}      |
     |                            |---(CC WS)---------------->|
     |                            |                            |
     |                            |  {"type":"assistant",...}   |
     |                            |<--(CC WS)-----------------|
     | [Shows response in chat]   |                            |
     |<--(browser WS)-----------|                            |
```

---

## 8. Priority Improvements for Meet-AI

| Priority | Improvement | Effort | Source Area |
|----------|-------------|--------|-------------|
| **P0** | **DirectConnect server in DO** — CC sessions connect via `--sdk-url`, web UI becomes the control surface | Large | DirectConnect |
| **P0** | WebSocket message dedup + seq numbers | Small | Bridge |
| **P1** | Permission bridge — route CC `control_request` to web UI, send `control_response` back | Medium | DirectConnect |
| **P1** | HTTP hook type (no CLI dependency) | Small | Hooks |
| **P1** | Unified PermissionRequest schema | Medium | Swarm |
| **P2** | Agent activity state machine in DO | Medium | Tasks |
| **P2** | SubagentStart/Stop hook events | Small | Hooks |
| **P2** | Slash command search scoring | Medium | ToolSearch |
| **P2** | DO message capping for long rooms | Small | Swarm |
| **P3** | Delta-based output streaming | Medium | Tasks |
| **P3** | Async hook registry pattern | Large | Hooks |
| **P3** | Semantic search for chat history | Large | Memory |

---

## 9. Architecture Reference

```
+-----------------------------------------------------+
|                   cli.tsx (entrypoint)                |
|  Fast paths: --version, --bridge, --daemon, etc.     |
+-------------------------+---------------------------+
                          | dynamic import
+-------------------------v---------------------------+
|                    main.tsx (803KB)                   |
|  init() -> setup() -> context -> state -> launchRepl |
+-------------------------+---------------------------+
                          |
+-------------------------v---------------------------+
|              <App> -> <REPL /> (React TUI)           |
|  Messages | PromptInput | Spinner | StatusLine       |
+---------+------------+------------------------------+
          |            |
+---------v------------v------------------------------+
|              QueryEngine (conversation loop)          |
|  User msg -> API call -> Tool execution -> Response   |
+--------------------------+--------------------------+
                           |
+--------------------------v--------------------------+
|              Tool Orchestration (41 tools)            |
|  Partition -> Permission -> Execute -> Yield          |
|  Read-only: parallel (up to 10)                       |
|  Write: serial                                        |
+-----------+------+-------+------+--------+-----------+
            |      |       |      |        |
         File    Bash   Agents   MCP    Bridge
         ops    (shell) (spawn) (ext.) (remote)
```
