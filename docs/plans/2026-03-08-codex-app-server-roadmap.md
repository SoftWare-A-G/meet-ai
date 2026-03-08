# Plan: Evolve `meet-ai` into a Codex App-Server Client

## Summary

Build a Codex-specific, CLI-first implementation that upgrades `meet-ai` from a message injector into a real `codex app-server` client for browser-backed rooms. The default model is one room mapped to one primary Codex orchestrator thread. The roadmap should preserve existing non-Codex behavior, but the Codex path should stop using the inbox fallback immediately in phase 1 and rely on app-server as the only live transport.

The build order is:
1. Stabilize the Codex bridge around app-server thread/turn/event primitives.
2. Expose streamed execution state in `meet-ai` data models and room payloads.
3. Add human-in-the-loop workflows like approvals and structured input.
4. Add higher-level Codex-native features such as reviews, skills/apps discovery, and selected experimental APIs.

## Key Changes

### Codex bridge behavior

- Replace the current "inject text plus optional inbox persistence" mindset with an explicit app-server session manager in the CLI.
- Keep one long-lived app-server connection per Codex orchestrator session.
- Treat room binding as `room -> codex session -> primary threadId`.
- Remove Codex inbox append/read from the live path in phase 1.
- Continue to support non-Codex runtimes unchanged.

### Public interfaces and state

- Extend the Codex binding/status model to persist:
  - `room_id`
  - `session_id`
  - `primary_thread_id`
  - current `active_turn_id` if known
  - bridge connection state
  - last app-server error / reconnect status
- Introduce a normalized Codex event envelope in the CLI/worker boundary so the worker/web UI can render:
  - thread lifecycle events
  - turn lifecycle events
  - item lifecycle and deltas
  - approval requests
  - user-input requests
  - MCP elicitation requests
  - review lifecycle
- Add room-visible message/event types for Codex-specific artifacts instead of flattening everything into plain chat messages and terminal snapshots.
- Preserve existing room chat messages as the canonical human-readable layer, but add structured event records for richer UI.

### Product behavior by subsystem

- CLI:
  - Owns app-server process lifecycle, reconnect behavior, request/response correlation, and room-to-thread routing.
  - Sends room-originated human prompts into `turn/start` or `turn/steer`.
  - Streams app-server notifications into worker/web-facing structured events.
  - Responds to server-initiated app-server requests using room UI decisions once those phases land.
- Worker/server:
  - Accepts and stores structured Codex event payloads in addition to normal messages/logs.
  - Broadcasts incremental updates over websocket to web clients.
  - Supports room-side actions that map back to app-server requests, such as approve/decline, interrupt, and review start.
- Web UI:
  - Renders Codex activity as first-class room objects: turn state, plan updates, diffs, command output, review output, approvals.
  - Keeps plain chat readable while exposing a richer "session activity" panel or grouped timeline for Codex runs.
  - Does not attempt multi-thread workspace semantics by default; related child threads are surfaced as linked sessions, not peers.

## Phased Roadmap

### Phase 1: Core Codex app-server bridge

- Make app-server the only Codex live path.
- On bridge startup:
  - `initialize`
  - `initialized`
  - resolve/create primary thread binding
  - `thread/resume` when a thread exists, otherwise `thread/start`
- Track `threadId`, `turnId`, and loaded-thread status explicitly.
- Route new room input:
  - `turn/steer` when the primary thread has an active turn and expected turn id is known
  - `turn/start` otherwise
- Stream these notifications into structured room events:
  - `thread/started`
  - `thread/status/changed`
  - `turn/started`
  - `turn/completed`
  - `item/started`
  - `item/completed`
  - `item/agentMessage/delta`
  - command/file output deltas
  - `turn/plan/updated`
  - `turn/diff/updated`
  - `error`
- Remove Codex inbox fallback codepaths from the primary listen loop and status UX.
- Add reconnect logic:
  - if app-server exits, mark bridge degraded, restart, re-initialize, re-resume thread
  - do not lose room binding or primary thread mapping
- Acceptance criteria:
  - A room message can start a new Codex turn.
  - A second room message can steer an active turn.
  - The room UI can see streamed assistant text, command output, diff updates, and final turn completion.

### Phase 2: Structured event model and browser rendering

- Add Codex-specific persisted/broadcast event types in the worker/websocket layer.
- Build UI components for:
  - active thread header
  - turn status and token/progress area
  - agent message streaming
  - command execution blocks with output
  - file change summary plus full turn diff
  - plan updates
  - error/failure state
- Keep terminal mirroring optional/secondary for Codex rooms; app-server events should become the primary execution visualization.
- Add room controls for:
  - interrupt active turn
  - retry/send follow-up prompt
  - open linked review or forked thread
- Acceptance criteria:
  - A human watching the browser can understand Codex state without reading raw terminal output.
  - Diff and command output update live without page refresh.

### Phase 3: Human control flows

- Implement app-server server-request handling instead of auto-declining:
  - `item/commandExecution/requestApproval`
  - `item/fileChange/requestApproval`
  - `item/tool/requestUserInput`
  - `mcpServer/elicitation/request`
- Add worker endpoints and websocket actions for resolving pending requests from the room UI.
- Add request lifecycle UI:
  - pending
  - accepted/declined/canceled
  - resolved/expired
- For approvals:
  - render command, cwd, actions, and any requested permissions
  - render file diffs for file-change approval
- For user input:
  - render the short-question form directly in-room
- For MCP elicitation:
  - support both form and URL-mode prompts
- Acceptance criteria:
  - Codex can pause on a command/file change and continue only after a room decision.
  - Tool-driven user questions can be answered from the browser and resume the turn.

### Phase 4: Codex-native higher-level features

- Add room-triggered `review/start` support:
  - current changes
  - base branch
  - specific commit
  - custom review prompt
- Support detached review threads as linked room-visible sessions, not full multi-thread peers.
- Add `skills/list` and `app/list` discovery surfaces so the browser can show available Codex skills/apps for the current workspace.
- Allow room prompts to attach:
  - skill items
  - app mention items
- Add thread utilities:
  - `thread/list`
  - `thread/read`
  - `thread/fork`
  - `thread/archive` / `thread/unarchive`
  - `thread/compact/start`
  - `thread/rollback`
- Acceptance criteria:
  - A human can trigger a review from the room and read the result inline.
  - The room can surface discoverable skills/apps for the bound workspace.

### Phase 5: Selected experimental capabilities

- Include only these experimental APIs in the roadmap:
  - `dynamicTools`
  - `thread/backgroundTerminals/clean`
  - selected realtime support only after core browser UX is stable
- For `dynamicTools`:
  - expose a narrow meet-ai-owned tool surface back to Codex, such as room history, participant lookup, task/sidebar operations, or attachment fetch
  - keep the schema small and explicit
- For realtime:
  - treat as a later optional capability for voice/live sessions
  - do not let it shape the core room model
- Do not plan plugin marketplace or remote-skill installation as core scope.

## Capability Matrix

| Capability | App-server support | `meet-ai` current state | Planned state |
| --- | --- | --- | --- |
| Start/resume thread | Stable | Partial | Phase 1 full |
| Steer active turn | Stable | Partial | Phase 1 full |
| Stream item/turn events | Stable | Minimal | Phase 1-2 full |
| Interrupt turn | Stable | Missing | Phase 2 |
| Command approvals | Stable | Auto-decline | Phase 3 |
| File approvals | Stable | Auto-decline | Phase 3 |
| `requestUserInput` | Stable/experimental flow surface | Auto-empty | Phase 3 |
| MCP elicitation | Stable | Auto-cancel | Phase 3 |
| Reviews | Stable | Missing | Phase 4 |
| Skills/apps discovery | Stable | Missing | Phase 4 |
| Thread history/archive/fork | Stable | Missing | Phase 4 |
| Dynamic tools | Experimental | Missing | Phase 5 selected |
| Realtime text/audio | Experimental | Missing | Phase 5 selected |
| Inbox fallback | Legacy workaround | Present | Removed in Phase 1 |

## Test Plan

- Bridge lifecycle:
  - initialize + resume existing thread
  - initialize + create/start new thread
  - app-server crash/restart and thread reattachment
- Turn routing:
  - first room message starts a turn
  - follow-up message steers an in-flight turn
  - interrupt stops active turn cleanly
- Event streaming:
  - agent text deltas render in order
  - command output deltas aggregate correctly
  - diff updates replace prior turn diff snapshots correctly
  - plan updates reflect latest server state
- Approval flows:
  - command approval accept/decline/session decision
  - file approval accept/decline
  - stale request cleanup on turn completion/interruption
- Structured input flows:
  - `tool/requestUserInput` answer submission
  - MCP form response
  - MCP URL flow completion/cancel
- Higher-level features:
  - review inline
  - review detached thread linkage
  - skill/app discovery for current cwd
  - thread fork/archive/unarchive/read
- Backward compatibility:
  - non-Codex meet-ai runtime still works unchanged
  - Codex-specific UI only activates for Codex-bound rooms

## Assumptions and Defaults

- Default room model: one room maps to one primary Codex orchestrator thread.
- CLI-first scope means the roadmap prioritizes bridge correctness and worker protocol changes over ambitious web redesign.
- Existing non-Codex behavior must be preserved.
- Codex inbox fallback should be removed immediately in phase 1, not retained as recovery/debug state.
- Approval handling is important but intentionally follows stable event streaming, not the first bridge milestone.
- Experimental APIs are limited to selected, high-leverage features only; they do not drive core architecture.
