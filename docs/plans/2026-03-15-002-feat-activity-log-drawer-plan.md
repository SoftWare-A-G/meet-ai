---
title: "feat: Activity Log Drawer"
type: feat
status: active
date: 2026-03-15
origin: docs/brainstorms/2026-03-15-activity-log-drawer-brainstorm.md
---

# feat: Activity Log Drawer

## Overview

A bottom drawer panel using Base UI Drawer (`@base-ui/react/drawer` v1.3.0, already installed) that shows the full activity log for a room. The existing ActivityBar becomes the drawer trigger — tap it to expand into the full log view. Agent-based filtering via horizontal pills. Frontend-only — reuses existing log data from ChatView.

**Problem:** The ActivityBar shows only the latest action per agent. The full log history is buried in collapsed groups within the chat stream. Users need a dedicated, filterable view of all recent agent activity without scrolling through conversation. (see brainstorm: `docs/brainstorms/2026-03-15-activity-log-drawer-brainstorm.md`)

## Proposed Solution

### Architecture Decisions (resolved from SpecFlow analysis)

1. **Component tree:** Render `ActivityLogDrawer` inside `ChatView` (direct access to `messages` state). Drawer state managed locally in ChatView — no prop drilling needed since the trigger (ActivityBar) is already inside ChatView.
2. **Non-modal drawer:** Users can interact with chat (type, scroll) while drawer is in peek state. `modal={false}` on the Drawer.
3. **ActivityBar IS the drawer trigger:** The existing ActivityBar becomes tappable — clicking it opens the drawer. Add a small chevron/drag handle to indicate expandability. When drawer is open, ActivityBar is hidden (the drawer replaces it). When drawer closes, ActivityBar reappears. One continuous pattern: collapsed state = ActivityBar, expanded state = full drawer.
4. **No MainHeader button needed.** The ActivityBar is the entry point. Removes Phase 3 entirely.
4. **Flat log list:** Individual entries (not grouped into LogGroups), since agent filtering would break group boundaries.
5. **Agent pills from `parseAgentActivity()`:** Consistent with ActivityBar. Logs with `sender: 'hook'` are filtered out — only attributed logs appear.
6. **Initial snap: peek (30vh).** User drags to expand to 70vh.
7. **Swipe zone: header/handle only.** Scrollable log list does not trigger drawer resize. Uses `Drawer.SwipeArea` on the handle.
8. **Close on room navigation.** ChatView remounts via `key={room.id}`, drawer state resets.
9. **Z-index: z-40** (below modals/dialogs at z-50). Non-modal, coexists with chat.
10. **Filter state shape:** `{ agent: string | null }` — designed so `type` filter can slot in later as `{ agent: string | null, type: string | null }` (per Codex suggestion in brainstorm).

### Phase 1: Drawer UI Wrapper

Create a Base UI Drawer wrapper following the existing Dialog wrapper pattern at `packages/worker/src/app/components/ui/dialog.tsx`.

**New file:** `packages/worker/src/app/components/ui/drawer.tsx`

Wrap these Drawer subcomponents:
- `DrawerRoot` — wraps `Drawer.Root` with `data-slot="drawer"`
- `DrawerPortal` — wraps `Drawer.Portal`
- `DrawerBackdrop` — wraps `Drawer.Backdrop` with styling (semi-transparent, no pointer blocking for non-modal)
- `DrawerPopup` — wraps `Drawer.Popup` with position/size styling
- `DrawerTitle` — wraps `Drawer.Title`
- `DrawerClose` — wraps `Drawer.Close`
- `DrawerSwipeArea` — wraps `Drawer.SwipeArea`

Key props on Root:
- `open` + `onOpenChange` (controlled)
- `modal={false}`
- `snapPoints={[0.3, 0.7]}` — peek and expanded
- `position="bottom"`

### Phase 2: ActivityLogDrawer Component

**New files:**
- `packages/worker/src/app/components/ActivityLogDrawer/ActivityLogDrawer.tsx`
- `packages/worker/src/app/components/ActivityLogDrawer/index.ts`

**Props:**
```ts
type ActivityLogDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  messages: DisplayMessage[]  // full messages array from ChatView
  teamInfo: TeamInfo | null
}
```

**Internal structure:**
```
DrawerRoot (non-modal, bottom, snapPoints=[0.3, 0.7])
  DrawerBackdrop (subtle, allows click-through)
  DrawerPopup (z-40, rounded-t-xl)
    DrawerSwipeArea (handle bar at top)
      [drag handle indicator — 32x4px rounded bar]
    DrawerTitle ("Activity" — sr-only or visible small header)
    DrawerClose (X button, top-right)
    [AgentFilterPills] — horizontal scrollable pills
    [LogEntryList] — scrollable flat list, reverse chronological
```

**AgentFilterPills:**
- Derive unique agents from `messages.filter(m => m.type === 'log').map(parseAgentActivity).filter(Boolean)`
- "All" pill + one per unique agent name
- Active pill gets highlighted background
- Agent pills colored via `ensureSenderContrast()` matching ActivityBar/TeamSidebar
- Horizontal scroll on overflow (mobile-friendly)

**LogEntryList:**
- Filter `messages` to `type === 'log'` only
- Filter out `sender === 'hook'` (unattributed)
- If agent filter active, filter to matching agent
- Sort reverse chronological (newest first)
- Each entry renders: `[timestamp] [colored agent name] [action text]`
- Diff entries (content starts with `[diff:`) render with existing `DiffBlock` component, collapsed by default
- New logs arriving via WebSocket prepend without disrupting scroll position (if user scrolled down)

**Relative timestamps:** Reuse `formatRelativeTime()` from `dates.ts` (already built in Phase 1 of previous feature). Add a 15s refresh tick (same pattern as ActivityBar/TeamSidebar).

### Phase 3: ActivityBar → Drawer Trigger + State Wiring

**Modify:** `packages/worker/src/app/components/ActivityBar/ActivityBar.tsx`
- Make the entire bar clickable (`cursor-pointer`, `onClick` handler)
- Add a small chevron-up icon or drag handle indicator (right side) so it reads as expandable
- Keep the existing one-line-per-agent display as the collapsed state
- When drawer is open, the ActivityBar hides (drawer replaces it)
- Per Codex: keep the collapsed bar compact (latest action only), no multi-line variant

**Modify:** `packages/worker/src/app/components/ChatView/ChatView.tsx`
- Add local state: `const [activityDrawerOpen, setActivityDrawerOpen] = useState(false)`
- Pass `onClick={() => setActivityDrawerOpen(true)}` to ActivityBar
- Render `<ActivityLogDrawer>` after ActivityBar, passing `messages`, `teamInfo`, and open/close state
- Conditionally hide ActivityBar when drawer is open

## Technical Considerations

### Performance
- **100 log limit:** Current hardcoded limit is sufficient for v1. No backend change.
- **DiffBlock lazy rendering:** DiffBlocks within the drawer should only parse diffs when expanded (the existing DiffBlock already uses `useMemo` + collapsed default).
- **No list virtualization needed** for 100 entries in v1. Can add later if limit increases.
- **Throttle consideration:** Incoming logs already go through ChatView's message state. No additional throttling needed for the drawer — it reads from the same array.

### Mobile
- **Snap points use viewport fractions** (0.3, 0.7) which adapt to any screen size.
- **Safe area:** Add `pb-[env(safe-area-inset-bottom)]` to the drawer popup for iOS home indicator.
- **Swipe conflict resolved:** `SwipeArea` limited to handle bar. Scrollable log list uses normal touch scrolling.
- **Agent pills:** Horizontal scroll with `overflow-x-auto` for many agents on narrow screens.

### Accessibility
- `Drawer.Title` provides accessible name ("Activity Log")
- Non-modal: no focus trap, keyboard users can Tab between drawer and chat
- Escape key dismisses drawer (Base UI default)
- Log list is a landmark with `role="log"` for screen readers
- Agent filter pills use `role="tablist"` / `role="tab"` pattern

## Acceptance Criteria

- [ ] Base UI Drawer wrapper created following Dialog wrapper pattern
- [ ] ActivityLogDrawer renders as bottom drawer with snap points (30%, 70%)
- [ ] Drawer is non-modal — chat interaction works while drawer is open
- [ ] Tapping ActivityBar opens the drawer (ActivityBar = collapsed state, drawer = expanded state)
- [ ] ActivityBar shows chevron/handle indicator for expandability
- [ ] ActivityBar hidden when drawer is open, reappears on close
- [ ] Agent filter pills show [All] + per-agent tabs derived from log data
- [ ] Filtering by agent shows only that agent's logs
- [ ] Logs with `sender: 'hook'` excluded from drawer
- [ ] Log entries shown as flat list, reverse chronological, with timestamps
- [ ] Diff entries rendered with existing DiffBlock component (collapsed)
- [ ] Real-time: new logs prepend without disrupting scroll position
- [ ] Drawer closes on room navigation
- [ ] Swipe-to-dismiss works on handle only, not on scrollable content
- [ ] 15s timestamp refresh (same pattern as ActivityBar)
- [ ] iOS safe area handled (`env(safe-area-inset-bottom)`)
- [ ] Keyboard: Escape dismisses, Tab navigates normally (non-modal)
- [ ] `Drawer.Title` provides accessible name
- [ ] Filter state shaped as `{ agent: string | null }` for future type filter extensibility
- [ ] Works on mobile (agent pills scroll horizontally, snap points adapt)

## Dependencies & Risks

- **Base UI Drawer API stability:** v1.3.0 is confirmed with full snap points. The Drawer API may have edge cases with scroll + swipe interaction — needs hands-on testing.
- **Stick-to-bottom interaction:** The drawer is a portal overlay, not inserted into the ChatView flex flow. Should not affect `use-stick-to-bottom`. Verify during implementation.
- **z-index layering:** Drawer at z-40 should sit below Dialog modals (z-50) but above normal content. Verify with Canvas/Terminal open simultaneously.

## Implementation Order

1. **Phase 1** — Drawer UI wrapper (`ui/drawer.tsx`)
2. **Phase 2** — ActivityLogDrawer component (drawer content, filters, log list)
3. **Phase 3** — ActivityBar trigger + state wiring in ChatView

All phases are tightly coupled — best done by a single agent sequentially.

## Sources & References

- **Origin brainstorm:** [docs/brainstorms/2026-03-15-activity-log-drawer-brainstorm.md](docs/brainstorms/2026-03-15-activity-log-drawer-brainstorm.md) — Key decisions: bottom drawer, agent filter only, keep 100 limit, Base UI Drawer component, structure for future type filter
- **Base UI Drawer docs:** https://base-ui.com/react/components/drawer
- **Dialog wrapper pattern:** `packages/worker/src/app/components/ui/dialog.tsx`
- **ActivityBar (trigger):** `packages/worker/src/app/components/ActivityBar/ActivityBar.tsx`
- **ChatView (data source):** `packages/worker/src/app/components/ChatView/ChatView.tsx`
- **Activity parser:** `packages/worker/src/app/lib/activity.ts`
- **State toggle pattern:** `packages/worker/src/app/routes/chat/$id.tsx`
- **DiffBlock (reuse):** `packages/worker/src/app/components/DiffBlock/DiffBlock.tsx`
- **LogGroup (reference):** `packages/worker/src/app/components/LogGroup/LogGroup.tsx`
