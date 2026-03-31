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

| Mechanism | Location | Cross-Machine | Real-time | Auto-submit | Requires |
|-----------|----------|---|---|---|---|
| **tmux send-keys** | Pane target | No | Instant | Yes | tmux + pane ID |
| **Mailbox (JSON file)** | ~/.claude/teams/ | No | ~1s delay | Yes (polled) | Team context |
| **Bridge WebSocket** | Remote Control | **Yes** | Instant | Yes | OAuth + /remote-control |
| **Peer Bridge** | SendMessage tool | **Yes** | Instant | Yes | Bridge connection |
| **UDS Socket** | Local socket | No | Instant | Yes | Socket path |
| **Structured stdin** | SDK mode | No | Instant | Async | -p flag |

### tmux send-keys (Direct Terminal Injection)

```typescript
// From TmuxBackend.ts
async sendCommandToPane(paneId, command, useExternalSession = false) {
  await runTmux(['send-keys', '-t', paneId, command, 'Enter'])
}
```

Works for injecting text directly into a CC tmux pane. Fragile — requires knowing the pane ID and CC being in tmux.

### Mailbox System (Standard Inter-Agent Path)

Write JSON to `~/.claude/teams/{team}/inboxes/{agent}.json`.
Polled every 1000ms. Messages submitted as user turns.
File-locking prevents race conditions.

### Bridge/Remote Control (Cross-Machine WebSocket)

CC's `/remote-control` command starts a WebSocket bridge to Anthropic's servers.
Web UI at claude.ai can send `type: 'user'` messages that are submitted as REPL turns.
This is how the web UI sends prompts to local CLI sessions.

### UDS (Unix Domain Socket)

```typescript
// SendMessageTool.ts
if (addr.scheme === 'uds') {
  await sendToUdsSocket(addr.target, input.message)
}
```

Local peer-to-peer messaging via Unix sockets. Low latency, same machine only.

### Key Insight: No Public Local HTTP API

CC does NOT expose a local HTTP server for message injection.
The bridge requires Anthropic OAuth. There's no `localhost:PORT/api/message` endpoint.

### Recommendation for meet-ai

For sending messages from web UI into CC sessions:
1. **Mailbox** (simplest) — meet-ai CLI writes to inbox file, CC polls it
2. **tmux send-keys** (direct) — meet-ai CLI runs `tmux send-keys` to inject text
3. **Bridge** (cross-machine) — requires Anthropic OAuth, not self-hostable

---

## 8. Priority Improvements for Meet-AI

| Priority | Improvement | Effort | Source Area |
|----------|-------------|--------|-------------|
| **P0** | WebSocket message dedup + seq numbers | Small | Bridge |
| **P0** | HTTP hook type (no CLI dependency) | Small | Hooks |
| **P1** | Unified PermissionRequest schema | Medium | Swarm |
| **P1** | Agent activity state machine in DO | Medium | Tasks |
| **P1** | SubagentStart/Stop hook events | Small | Hooks |
| **P2** | Slash command search scoring | Medium | ToolSearch |
| **P2** | DO message capping for long rooms | Small | Swarm |
| **P2** | Delta-based output streaming | Medium | Tasks |
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
