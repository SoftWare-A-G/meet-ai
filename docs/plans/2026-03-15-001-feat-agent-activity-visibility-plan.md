---
title: "feat: Agent Activity Visibility"
type: feat
status: active
date: 2026-03-15
origin: docs/brainstorms/2026-03-15-agent-activity-visibility-brainstorm.md
---

# feat: Agent Activity Visibility

## Overview

Add real-time agent activity visibility to the Meet AI web UI through two components: a **Floating Activity Bar** (always-visible, between messages and input) and **TeamSidebar per-agent status** (latest action under each member). Both derive state from existing WebSocket log entries.

**Problem:** Agent activity logs exist but are buried in the chat stream — collapsed by default, monospace, 65% opacity. The TeamSidebar only shows binary active/inactive. Users lose awareness that agents are working. (see brainstorm: `docs/brainstorms/2026-03-15-agent-activity-visibility-brainstorm.md`)

## Problem Statement / Motivation

When agents are actively working (reading files, running commands, editing code), the only signal is collapsed log groups deep in the chat history. The TeamSidebar shows a green or gray dot — nothing more. Users report "I stopped seeing that something is happening." This creates uncertainty, especially during long tool chains where agents are productive but silent.

## Proposed Solution

### Phase 0: Hook — Add Agent Identity to Log Entries (CLI-side only)

**Why this is needed:** The SpecFlow analysis revealed that all log entries use `sender: 'hook'` with no agent name. The content is `"Edit: file.tsx"`, not `"agent-name: Edit: file.tsx"`. Without agent identity, per-agent activity display is impossible.

**Change:** In `packages/cli/src/commands/hook/log-tool-use/usecase.ts`, resolve the agent name from the team config (match `session_id` → team member name) and use it as the `sender` field on log entries instead of `'hook'`. The worker API already accepts any sender string — no API/DB change needed. Fall back to `'hook'` if no team member matches.

**Files:**
- `packages/cli/src/commands/hook/log-tool-use/usecase.ts` — resolve agent name from team config
- `packages/cli/src/lib/hooks/room.ts` (or wherever `findRoom` lives) — extend to also return agent name

### Phase 1: Shared Activity State Layer

Create a centralized hook and types for deriving per-agent activity from the log stream.

**New files:**
- `packages/worker/src/app/hooks/useAgentActivity.ts` — the core hook
- `packages/worker/src/app/lib/activity.ts` — types + parsing utility

**Types** (`activity.ts`):
```ts
type AgentState = 'working' | 'waiting' | 'idle'

type AgentActivity = {
  agentName: string
  state: AgentState
  latestAction: string      // e.g., "Edit: ChatView.tsx"
  lastActivityAt: string    // ISO timestamp from log entry
  color: string             // from TeamMember.color
}
```

> **Scoping note:** The brainstorm mentioned an "error" state, but the hook doesn't distinguish errors from successes in log content. Skipping error state for v1 — can add later when the hook includes error status in log entries.

**Hook** (`useAgentActivity.ts`):
- **Input:** `messages` array (contains both messages and logs), `teamInfo`
- **Output:** `Map<string, AgentActivity>` keyed by agent name
- **Logic:**
  1. Filter messages to `type === 'log'` entries
  2. For each log, extract agent name from `sender` field (Phase 0 makes this possible)
  3. Track latest log per agent name
  4. Derive state:
     - `working` — last log within 20 seconds (middle ground per brainstorm's 15-30s range)
     - `waiting` — cross-reference with `planDecisions`/`questionAnswers`/`permissionDecisions` maps (pending status for the agent)
     - `idle` — no log within timeout, no pending reviews
  5. Per-agent timer: `setTimeout` per agent, reset on each new log. On timeout → transition to `idle`
  6. Throttle state updates to max 2Hz to avoid layout thrashing during rapid tool calls

**Lift to ChatContext** (`chat-context.ts`):
- Add `agentActivity: Map<string, AgentActivity>` to `ChatContextValue`
- Set from `ChatView` via a new `onAgentActivity` callback (same pattern as `onTeamInfo`)

**Relative time utility** (`dates.ts`):
- Add `formatRelativeTime(isoTimestamp: string): string` — returns "Xs ago", "Xm ago", "Xh ago"
- Update interval: every 15 seconds via `setInterval`, cleaned up on unmount

### Phase 2: Floating Activity Bar

**New component:** `ActivityBar/ActivityBar.tsx` + `ActivityBar/index.ts`

**Placement:** Between `<MessageList />` and `<ChatInput />` in `ChatView.tsx`. Fixed height, does not participate in scroll.

**Rendering rules:**
- **Hidden** when `teamInfo` is null (no agents in room) — matches existing `showTeamToggle={!!teamInfo}` pattern
- **One line per active agent** (`status === 'active'` in TeamMember): `[colored dot] [agent-name]: [latest action] · [Xs ago]`
- **Max 4 lines visible** — if more agents, show "+N more" with the most recently active agents prioritized
- **All idle fallback:** "All agents idle · last activity Xm ago" (single line, no per-agent breakdown)
- **No animation when idle** — remove motion/pulse so it doesn't feel noisy (per brainstorm)

**Styling:**
- `text-xs`, subtle background (`bg-neutral-900/50`), `border-t border-neutral-800`
- Agent name in their team color via `ensureSenderContrast()`
- State dot: green for working, yellow for waiting, gray for idle
- Non-color indicator alongside dot: working gets a subtle pulse, waiting shows "⏳" or similar text label

**Accessibility:**
- `role="status"` + `aria-live="polite"` on container
- State communicated via text label, not color alone (WCAG 1.4.1)

**Stick-to-bottom interaction:** The bar is a fixed-height sibling, not inside the scroll container. Test that `use-stick-to-bottom` still works — if it breaks, use `padding-bottom` on MessageList equal to bar height instead.

**Files to modify:**
- `packages/worker/src/app/components/ChatView/ChatView.tsx` — insert `<ActivityBar />` between MessageList and ChatInput, wire up `useAgentActivity`

**Files to create:**
- `packages/worker/src/app/components/ActivityBar/ActivityBar.tsx`
- `packages/worker/src/app/components/ActivityBar/index.ts`

### Phase 3: TeamSidebar Enhancement

**Modify:** `TeamSidebar/TeamSidebar.tsx` — enhance `MemberRow` component.

**Current MemberRow renders:** colored dot + name + model name

**Enhanced MemberRow renders:**
- Row 1: state dot (colored by state) + name + model name (unchanged layout)
- Row 2 (new): latest action text + relative timestamp in `text-[11px] opacity-60`
  - e.g., `Edit: ChatView.tsx · 12s ago`
  - Only shown for active agents with recent activity
  - Hidden for inactive agents (they remain dimmed as-is)

**Data source:** Read `agentActivity` from `ChatContext` — same data as ActivityBar

**Files to modify:**
- `packages/worker/src/app/components/TeamSidebar/TeamSidebar.tsx`

## Technical Considerations

### Architecture

- **No worker/API/DB changes.** The only non-frontend change is Phase 0 (CLI hook sender field).
- **State flows up through existing patterns:** ChatView → onAgentActivity callback → ChatLayout → ChatContext → TeamSidebar. Same as teamInfo/tasksInfo.
- **Single parsing utility** (`activity.ts`) — all string parsing happens here, not scattered across components. Easy to promote to a dedicated WS message type later (per Codex's suggestion in brainstorm).

### Performance

- **Throttle:** `useAgentActivity` throttles output to max 2Hz (500ms). High-frequency logging from rapid tool calls won't cause re-render storms.
- **Timer cleanup:** All per-agent `setTimeout` handles cleaned up on unmount and room navigation. `ChatView` is keyed by `room.id`, so unmount is automatic.
- **Relative time updates:** Single `setInterval` (15s) for the whole bar, not per-agent timers for timestamp display.
- **Background tab:** `visibilitychange` event recalculates relative timestamps on tab foreground (browsers throttle setInterval in background tabs).

### Mobile

- **ActivityBar:** Max 4 lines prevents viewport exhaustion on small screens. "+N more" for overflow.
- **TeamSidebar:** Activity text wraps within existing 330px/85vw constraint. `text-[11px]` keeps it compact.
- **Bar visible when sidebar closed:** The primary use case on mobile — sidebar is an overlay, bar is always visible.

## System-Wide Impact

- **Interaction graph:** Log entries arrive via WebSocket → `useRoomWebSocket` → ChatView `onWsMessage` → appended to messages state → `useAgentActivity` derives activity → ActivityBar + TeamSidebar re-render. No new event sources.
- **Error propagation:** If the hook fails to resolve agent name (Phase 0), it falls back to `sender: 'hook'` — the ActivityBar gracefully shows "hook" as the agent name. No crash path.
- **State lifecycle risks:** Activity state is ephemeral (derived from messages array + timers). No persistent state to become inconsistent. Room navigation unmounts and rebuilds.
- **API surface parity:** No new API endpoints. The CLI hook change (Phase 0) is backward-compatible — existing rooms with `sender: 'hook'` logs still work, they just show "hook" instead of agent names.

## Acceptance Criteria

- [ ] Log entries include agent name as `sender` (not `'hook'`) when the hook can resolve the agent from team config
- [ ] `useAgentActivity` hook derives per-agent state (working/waiting/idle) from log stream
- [ ] Activity parsing centralized in `activity.ts` — no string parsing in components
- [ ] Floating ActivityBar renders between MessageList and ChatInput
- [ ] Bar shows one line per active working/waiting agent with colored dot, name, action, timestamp
- [ ] Bar shows "All agents idle · last activity Xm ago" when no recent activity
- [ ] Bar hidden when `teamInfo` is null (no agents in room)
- [ ] Bar capped at 4 visible lines with "+N more" overflow
- [ ] TeamSidebar MemberRow shows latest action + relative timestamp for active agents
- [ ] Both components read from same `agentActivity` state via ChatContext
- [ ] `role="status"` + `aria-live="polite"` on ActivityBar for screen reader support
- [ ] State communicated via text, not color alone (WCAG 1.4.1)
- [ ] State updates throttled to max 2Hz
- [ ] Relative timestamps update every 15 seconds, recalculate on tab foreground
- [ ] `use-stick-to-bottom` scroll behavior unbroken by ActivityBar insertion
- [ ] Works on mobile (bar visible, sidebar overlay consistent)

## Dependencies & Risks

- **Stick-to-bottom risk:** Inserting ActivityBar between MessageList and ChatInput could break scroll anchoring. Mitigation: test early, fall back to absolute positioning or padding approach.
- **Agent name resolution (Phase 0):** Hook must read team config to find agent name. If the team config format changes, the hook breaks gracefully (falls back to 'hook').
- **No error state in v1:** Users won't see visual distinction when agents hit errors. Acceptable for first cut — add when hook includes error status.

## Implementation Order

1. **Phase 0** — Hook agent identity (~15 lines changed in CLI)
2. **Phase 1** — Shared activity layer (types, hook, context wiring)
3. **Phase 2** — Floating ActivityBar component
4. **Phase 3** — TeamSidebar enhancement

Ship Phase 2 first for immediate user value (per brainstorm: "floating bar first, sidebar detail second"). Phase 3 can follow separately.

## Sources & References

- **Origin brainstorm:** [docs/brainstorms/2026-03-15-agent-activity-visibility-brainstorm.md](docs/brainstorms/2026-03-15-agent-activity-visibility-brainstorm.md) — Key decisions: both sidebar + bar, always visible, latest only, reuse logs, centralized parsing, state machine
- **Hook implementation:** `packages/cli/src/commands/hook/log-tool-use/usecase.ts`
- **Hook summarize format:** `packages/cli/src/lib/hooks/summarize.ts`
- **ChatView composition:** `packages/worker/src/app/components/ChatView/ChatView.tsx:421-453`
- **TeamSidebar current:** `packages/worker/src/app/components/TeamSidebar/TeamSidebar.tsx:14-25`
- **WebSocket handler:** `packages/worker/src/app/hooks/useRoomWebSocket.ts:99-135`
- **ChatContext:** `packages/worker/src/app/lib/chat-context.ts`
- **Layout structure:** `packages/worker/src/app/routes/chat.tsx:255`
- **Log API endpoint:** `packages/worker/src/routes/rooms.ts:190`
- **Component conventions:** `.claude/rules/frontend/components.md`
