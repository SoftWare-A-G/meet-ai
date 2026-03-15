# Activity Log Drawer

**Date:** 2026-03-15
**Status:** Brainstorm complete
**Participants:** isnifer-atlas, team-lead, codex

## Problem

The just-shipped ActivityBar shows only the latest action per agent — it answers "who is doing what right now." But users also need to see the full timeline of recent agent activity without scrolling through the chat stream to find collapsed log groups. The chat stream mixes human conversation with agent activity, making it hard to get a pure activity-focused view.

## What We're Building

A **bottom drawer** panel that slides up from the bottom of the chat area, showing the full activity log for the room. It can be resized by dragging and provides a dedicated, filterable view of all agent tool calls.

## Why This Approach

- **Bottom drawer** feels natural for a "peek at recent activity" interaction — pull up for more detail, push down to dismiss. Common mobile pattern that works well on desktop too.
- **Agent filter only** keeps the UI simple — tabs or pills for [All] [agent-1] [agent-2]. Covers the primary use case (tracking a specific agent's work) without over-building.
- **Keep 100 log limit** — no backend changes needed. 100 entries is plenty for recent activity. Pagination can come later if needed.
- **Reuses existing log data** — same data already loaded in ChatView, no new API calls needed for the initial view. Real-time updates via existing WebSocket.

## Key Decisions

1. **UI pattern:** Bottom drawer (slide-up panel, resizable by dragging)
2. **Filters:** Agent filter only — tabs/pills for each active agent + "All"
3. **Log limit:** Keep at 100 for v1, no backend change
4. **Data source:** Reuse logs already loaded in ChatView + real-time WebSocket updates
5. **Trigger:** New button in MainHeader (Activity icon) to toggle the drawer open/closed
6. **Frontend-only:** No API, DB, or backend changes

## Design Details

### Drawer Component
- Use **Base UI Drawer** (`@base-ui/react/drawer`) — explicitly requested by isnifer-atlas
- Docs: https://base-ui.com/react/components/drawer#position
- `position="bottom"`, `swipeDirection="down"` for dismiss gesture
- Use `snapPoints` for peek state (~30%) + expanded state (~70%)
- Toggle via MainHeader button (same row as Canvas, Terminal, QR)

### Drawer Architecture Note (Codex)
- Structure drawer state so a **type filter** (Edits, Bash, Diffs) can slot in later without rewriting the list model
- v1 ships agent-only filter, but the data model should support adding type filter easily

### Log Entry Display
- Each entry: timestamp + agent name (colored) + action text
- Reverse chronological (newest at top)
- Diff entries rendered with existing DiffBlock component (collapsible)
- Real-time: new logs prepend to the list as they arrive via WebSocket

### Agent Filter
- Horizontal pills/tabs at the top of the drawer
- "All" tab shows everything
- One tab per agent that has logs in the current dataset
- Active tab highlighted, click to filter
- Agent tabs derived from unique senders in the log data

## Open Questions

None — all key decisions resolved.

## Next Steps

Run `/ce:plan` to create implementation plan.
