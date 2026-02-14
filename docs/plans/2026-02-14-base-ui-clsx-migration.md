# Base UI + clsx Migration Plan

## Summary
Analyzed all 40 components. Base UI has 36 primitives available. Here's the full plan.

---

## Phase 1: clsx adoption (low risk, high value)

These components have conditional className logic (ternaries, template literals with conditions) that would benefit from clsx:

1. **ChatInput** — pendingFiles status-based classes (error/uploading/done bg colors) on file chips (line 117)
2. **CodeBlock** — optional className append via ternary (line 11)
3. **Message** — status-based opacity classes (pending/failed) on wrapper div (line 42)
4. **RoomList** — active room highlighting conditional class (line 17)
5. **Sidebar** — mobile open/close translate-x conditional (line 20)
6. **TeamSidebar** — mobile open/close translate-x conditional (line 83), inactive member opacity (line 13)
7. **MemberRow (in TeamSidebar)** — inactive opacity conditional (line 13)
8. **TaskRow (in TeamSidebar)** — status-based color class selection (lines 25-28)
9. **KeySettingsPanel** — active tab bg/text conditional (line 131), copy button color conditional (lines 145, 157)
10. **KeyResultState** — shimmer class conditional (line 29), copied class conditional (line 38)
11. **LandingAgents** — animate-in visible conditional (line 7)
12. **LandingValueProps/ValuePropCard** — animate-in visible conditional (line 24)
13. **LandingQuickStart** — animate-in visible conditional (line 10)

**Estimated effort:** ~1-2 hours total. Pure className refactor, no behavior changes.

---

## Phase 2: Base UI primitives (medium risk, high value)

### Dialog (modals)
These 3 components implement custom modal patterns (overlay + stopPropagation + close-on-backdrop) that Base UI Dialog handles natively with proper focus trapping and accessibility:

- **SettingsModal** — Color schema settings. Currently: fixed overlay + div with click handling. Base UI Dialog would add: focus trap, Escape to close, aria-modal, scroll lock.
- **QRShareModal** — QR code share link. Same manual overlay pattern.
- **IOSInstallModal** — iOS install instructions. Same pattern.

**What changes:** Replace outer fixed-overlay div + inner content div with Dialog.Root/Dialog.Portal/Dialog.Backdrop/Dialog.Popup. Remove manual onClick stopPropagation and overlay click handlers. Base UI handles all of that.

### Toast
- **Toast** — Currently a simple timed div with CSS animation. Base UI Toast provides: swipe-to-dismiss, pause-on-hover, proper ARIA live region announcements, toast stacking.

**What changes:** Wrap with Toast.Provider at app root, replace the component with Toast.Root/Toast.Title. Remove manual setTimeout; Base UI handles auto-dismiss.

### Tabs
- **KeySettingsPanel** — Has a manual tab system (user/project/env) with state management and active tab styling. Base UI Tabs handles keyboard navigation (arrow keys), proper ARIA roles (tablist/tab/tabpanel).

**What changes:** Replace manual tab buttons + conditional content with Tabs.Root/Tabs.List/Tabs.Tab/Tabs.Panel. Remove activeTab state management.

### Collapsible
- **LogGroup** — Expandable/collapsible log entries with manual toggle state. Base UI Collapsible provides: proper ARIA expanded, smooth animations, keyboard support.

**What changes:** Replace manual expanded state + click handler with Collapsible.Root/Collapsible.Trigger/Collapsible.Panel.

### Tooltip
- **FormattingToolbar** — 5 buttons with title attributes. Base UI Tooltip provides: accessible tooltips with proper timing, positioning, keyboard trigger.
- **SidebarHeader** — Settings and close buttons with title attributes.
- **SidebarFooter** — Name, API key, install buttons with title attributes.
- **MainHeader** — Invite and team toggle buttons with title attributes.

**What changes:** Replace title= attributes with Tooltip.Root/Tooltip.Trigger/Tooltip.Popup for each button. Adds hover delay, focus triggering, proper positioning.

### Select
- **SettingsModal** — Has a native `<select>` for theme presets. Base UI Select provides: custom-styled dropdown, keyboard navigation, proper ARIA.

**What changes:** Replace native `<select>` with Select.Root/Select.Trigger/Select.Popup/Select.Option. Enables custom styling that matches the app theme.

### Field + Input
- **KeyPasteState** — API key input with error display. Base UI Field provides: label association, error message ARIA, validation state.
- **LoginPrompt** — Login input with error display. Same pattern.
- **SidebarFooter** — Inline name edit input.

**What changes:** Wrap inputs with Field.Root/Field.Label/Field.Error. Adds proper label-input association and error announcements.

---

## Phase 3: Base UI enhancements (lower priority)

These are optional improvements that add accessibility but aren't critical:

### Separator
- **LandingFooter**, **TokenScreen** — Use `<div>` with border-t as dividers. Base UI Separator adds role=separator for screen readers.

### Scroll Area
- **MessageList**, **RoomList** — Custom scrollable areas. Base UI Scroll Area provides custom-styled scrollbars. Low priority since native scroll works fine.

### No change needed (simple/static components):
- **ChatView** — orchestrator, no UI of its own
- **ColorPreview** — pure display grid
- **EmptyState** — simple static display
- **KeyHeadline** — simple h1 wrapper
- **KeyGenerateState** — buttons only, no complex interaction
- **KeyErrorState** — simple error display + retry button
- **KeyExistingState** — buttons + confirm toggle
- **KeyResultState** — display + copy button
- **KeyQuickStartSteps** — static instructional content
- **LandingHeader** — simple nav bar
- **LandingHero** — static hero section
- **LandingDemoChat** — imperative DOM animation (not React-friendly for Base UI)
- **LandingFooter** — static footer
- **NewMessagesPill** — simple clickable badge
- **SidebarBackdrop** — single div overlay
- **InstallButton** — platform-specific install logic
- **TokenScreen** — multi-platform install instructions
- **MessageList** — list renderer, no Base UI primitive fits

---

## Migration Order

### Batch 1: clsx (all 13 components, parallel)
Do all clsx adoptions first. Zero behavior change, just cleaner className logic. Can be done in one PR.

### Batch 2: Modals → Dialog (3 components)
1. SettingsModal
2. QRShareModal
3. IOSInstallModal

These share the same pattern so doing them together builds consistency. High accessibility impact.

### Batch 3: Tabs + Collapsible (2 components)
4. KeySettingsPanel (Tabs)
5. LogGroup (Collapsible)

Independent components, no cross-dependencies.

### Batch 4: Toast (1 component + provider setup)
6. Toast + add Toast.Provider to app root

Requires touching the app root, so do separately.

### Batch 5: Tooltips (4 components)
7. FormattingToolbar
8. SidebarHeader
9. SidebarFooter
10. MainHeader

All follow the same pattern: replace title= with Tooltip. Do together.

### Batch 6: Select + Field (3 components)
11. SettingsModal (Select — after Batch 2 Dialog migration)
12. KeyPasteState (Field)
13. LoginPrompt (Field)

### Batch 7: Separators (optional, low priority)
14. LandingFooter
15. TokenScreen

---

## Risk Assessment
- **Phase 1 (clsx):** Zero risk. Drop-in replacement for className logic.
- **Phase 2 Dialog:** Medium risk. Must test focus trapping doesn't break mobile keyboards. Test overlay click-to-close still works.
- **Phase 2 Toast:** Low risk. Behavior upgrade but simple swap.
- **Phase 2 Tabs:** Low risk. KeySettingsPanel is self-contained.
- **Phase 2 Tooltips:** Low risk. Additive — replaces title attributes.
- **Phase 2 Field:** Low risk. Wraps existing inputs.

Total estimated components to touch: **28 out of 40** (13 for clsx, 15 for Base UI primitives, with some overlap).
