# Agent Activity Visibility

**Date:** 2026-03-15
**Status:** Brainstorm complete
**Participants:** isnifer-atlas, team-lead, codex

## Problem

Agent activity logs exist in D1 and stream via WebSocket, but they get buried in the chat stream. Log groups are collapsed by default, monospace, 65% opacity — designed as an audit trail, not an attention signal. The TeamSidebar only shows binary active/inactive status. There is no real-time "agent is currently working on X" indicator.

**Result:** Users stop seeing that something is happening. Agents appear silent even while actively working.

## What We're Building

A two-part real-time activity visibility system:

1. **TeamSidebar enhancement** — Show the latest tool action under each active agent (e.g., "Edit: ChatView.tsx — 3s ago")
2. **Floating activity bar** — A compact, always-visible bar between the chat messages and input area showing one-line status per active agent

Both components derive data from existing log entries (no new WebSocket message types or backend changes needed).

## Why This Approach

- **Both sidebar + bar** covers all viewport states: sidebar open on desktop, bar visible when sidebar is closed or on mobile
- **Always visible bar** ensures the user always knows agents are working, even when idle ("All agents idle" with timestamp)
- **Latest action only** in the bar keeps it compact — the sidebar provides full detail
- **Reusing existing logs** means zero backend changes — the log-tool-use hook already sends structured data via WebSocket. The UI just extracts the most recent log per agent sender
- **Note (Codex):** Logs live in a separate `logs` table (not `messages`) and are pruned after 24h. This is fine for real-time activity display since we only need the latest entry, but worth knowing for retention expectations

## Key Decisions

1. **Placement:** Both TeamSidebar enhancement AND floating activity bar
2. **Bar idle behavior:** Always visible — shows "All agents idle" or last activity with timestamp
3. **Bar detail level:** Latest action only per agent (one line each)
4. **Data source:** Reuse existing log entries from WebSocket — no new message types, no backend changes
5. **Frontend-only change:** All work is in `packages/worker/src/app/components/`

## Design Details

### Agent State Machine (Codex suggestion)
Derive per-agent state from log freshness:
- **working** — new log within last 15-30s
- **waiting** — pending approval / plan review / question review
- **error** — error log detected
- **idle** — silence past timeout

Surface errors and waiting states with stronger visual treatment than normal tool summaries.

### Activity Parsing (Codex suggestion)
Normalize activity parsing in one shared utility — don't scatter string parsing across components. This makes it easy to promote to a dedicated WS message type later if needed.

### TeamSidebar Enhancement
- Under each active agent name, show their latest log entry content
- Format: tool summary + relative timestamp (e.g., "Edit: ChatView.tsx — 12s ago")
- Show state dot (working/waiting/error/idle) alongside agent name
- Update in real-time as new log entries arrive via WebSocket
- Inactive agents remain dimmed, no activity line

### Floating Activity Bar
- Positioned between MessageList and ChatInput
- One line per active agent: `[colored dot] [agent-name]: [latest action]`
- When all agents idle: "All agents idle — last activity 2m ago"
- Remove motion/animation when idle so it doesn't feel noisy
- Subtle background, compact height, no collapse/expand needed
- Updates live from the same log stream

### Implementation Order (Codex + team-lead aligned)
1. **Floating activity bar first** — immediate "something is happening" feedback, smallest change
2. **TeamSidebar detail second** — per-agent depth once bar proves the pattern

## Open Questions

None — all key decisions resolved.

## Next Steps

Run `/ce:plan` to create implementation plan.
