# Base UI Phase 2: AlertDialog + Drawer Dialogs Migration Plan

## Summary

Three migrations that replace custom confirmation UI and mobile drawer sidebars with Base UI primitives. These add proper accessibility (focus trap, Escape key, ARIA roles, scroll lock) and eliminate hand-rolled backdrop/transition logic.

| # | Component | Base UI Primitive | Risk |
|---|-----------|-------------------|------|
| 1 | KeyExistingState | AlertDialog | Low |
| 2 | Sidebar + SidebarBackdrop | Dialog (drawer) | Medium |
| 3 | TeamSidebar + inline backdrop | Dialog (drawer) | Medium |

---

## Migration 1: AlertDialog for KeyExistingState

### Current Implementation

**File:** `packages/worker/src/app/components/KeyExistingState/KeyExistingState.tsx`

The component uses a boolean `showConfirm` state to toggle between two views:

```tsx
const [showConfirm, setShowConfirm] = useState(false)

// When showConfirm is false: shows "Open Chat" link + "Generate New Key" button
{!showConfirm && (
  <>
    <div className="stagger-in flex flex-wrap justify-center gap-3">
      <Link to="/chat" ...>Open Chat</Link>
      <button onClick={handleShowConfirm}>Generate New Key</button>
    </div>
    <span>Your key is saved in this browser.</span>
  </>
)}

// When showConfirm is true: shows inline confirmation card
{showConfirm && (
  <div className="fade-in flex flex-col items-center gap-3 rounded-xl border ...">
    <p>This will create a new key.<br/>Your current key will keep working.</p>
    <div className="flex gap-3">
      <button onClick={handleCancel}>Cancel</button>
      <button onClick={onRegenerate}>Generate</button>
    </div>
  </div>
)}
```

**Problems with current approach:**
- No focus trap -- user can tab away from the confirmation
- No Escape key handling
- No ARIA roles (`role="alertdialog"`, `aria-labelledby`, `aria-describedby`)
- Confirmation is inline rather than a proper modal overlay, which may not draw enough attention
- The "Open Chat" and "Generate New Key" buttons are conditionally removed/added, causing layout shift

### What Base UI AlertDialog Provides

- `role="alertdialog"` + `aria-modal="true"` for screen readers
- Focus trap: Tab/Shift+Tab cycle stays within the confirmation
- Escape key dismissal
- Scroll lock on background content
- `AlertDialog.Title` and `AlertDialog.Description` for accessible labeling
- Backdrop overlay to visually separate the confirmation from the page
- Animation support via `data-starting-style` / `data-ending-style`

### Target State

```tsx
import { AlertDialog } from '@base-ui/react/alert-dialog'

export default function KeyExistingState({ apiKey, onRegenerate }: KeyExistingStateProps) {
  return (
    <>
      <KeyHeadline text="Welcome back." />
      <div className="flex flex-col items-center gap-4">
        <span className="stagger-in text-sm text-text-secondary">Your key is active:</span>
        <span className="stagger-in inline-block rounded-lg ...">
          {getKeyPrefix(apiKey)}
        </span>
        <div className="stagger-in flex flex-wrap justify-center gap-3">
          <Link to="/chat" ...>Open Chat →</Link>
          <AlertDialog.Root>
            <AlertDialog.Trigger className="inline-flex cursor-pointer ...">
              Generate New Key
            </AlertDialog.Trigger>
            <AlertDialog.Portal>
              <AlertDialog.Backdrop className="fixed inset-0 bg-black/50 z-50" />
              <AlertDialog.Popup className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 flex flex-col items-center gap-3 rounded-xl border border-edge-light bg-edge p-5">
                <AlertDialog.Title className="text-center text-sm text-text-primary">
                  This will create a new key.
                </AlertDialog.Title>
                <AlertDialog.Description className="text-center text-sm text-text-primary">
                  Your current key will keep working.
                </AlertDialog.Description>
                <div className="flex gap-3">
                  <AlertDialog.Close className="cursor-pointer rounded-full ...">
                    Cancel
                  </AlertDialog.Close>
                  <button type="button" className="cursor-pointer rounded-full ... text-red-400 ..." onClick={onRegenerate}>
                    Generate
                  </button>
                </div>
              </AlertDialog.Popup>
            </AlertDialog.Portal>
          </AlertDialog.Root>
        </div>
        <span className="stagger-in text-center text-sm text-text-muted">
          Your key is saved in this browser.
        </span>
      </div>
    </>
  )
}
```

### Files to Change

1. `packages/worker/src/app/components/KeyExistingState/KeyExistingState.tsx`

### Step-by-Step Instructions

1. Import `AlertDialog` from `@base-ui/react/alert-dialog`
2. Remove `useState` and `useCallback` imports (no longer needed)
3. Remove `showConfirm` state and `handleCancel`/`handleShowConfirm` callbacks
4. Remove the conditional rendering (`{!showConfirm && ...}` / `{showConfirm && ...}`)
5. Always render the "Open Chat" link and helper text (no more layout shift)
6. Wrap "Generate New Key" button in `AlertDialog.Root` + `AlertDialog.Trigger`
7. Add `AlertDialog.Portal` containing `AlertDialog.Backdrop`, `AlertDialog.Popup`
8. Move confirmation text into `AlertDialog.Title` + `AlertDialog.Description`
9. Replace Cancel button with `AlertDialog.Close`
10. Keep the Generate button as a regular `<button>` that calls `onRegenerate`
11. Preserve existing Tailwind classes for visual consistency

### Risk Assessment

**Low risk.**
- Self-contained component with no external state dependencies
- No mobile keyboard or touch gesture concerns (just buttons)
- The confirmation is currently inline; making it a modal overlay is a UX improvement
- Only removes state -- no new state management needed
- `onRegenerate` callback is unchanged

---

## Migration 2: Dialog (drawer) for Sidebar + SidebarBackdrop

### Current Implementation

**Files:**
- `packages/worker/src/app/components/Sidebar/Sidebar.tsx`
- `packages/worker/src/app/components/SidebarBackdrop/SidebarBackdrop.tsx`
- `packages/worker/src/app/routes/chat.tsx` (lines 99, 194-205)

**State management** is in `ChatLayout` (`chat.tsx`):
```tsx
const [sidebarOpen, setSidebarOpen] = useState(false)
// ...
<Sidebar ... isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
{sidebarOpen && <SidebarBackdrop onClick={() => setSidebarOpen(false)} />}
```

**Sidebar component** uses CSS translate for the drawer pattern on mobile (`max-[700px]`):
```tsx
<aside className={clsx(
  'w-[260px] flex flex-col shrink-0 border-r border-sidebar-border bg-sidebar-bg ...',
  'max-[700px]:fixed max-[700px]:left-0 max-[700px]:z-50 max-[700px]:h-full',
  'max-[700px]:transition-transform max-[700px]:duration-[250ms] max-[700px]:ease-out',
  'max-[700px]:-translate-x-full max-[700px]:w-[280px] max-[700px]:max-w-[85vw]',
  isOpen && 'max-[700px]:translate-x-0'
)}>
```

On desktop (>700px), the sidebar is always visible as a static panel. On mobile (<=700px), it slides in from the left and shows a backdrop.

**SidebarBackdrop** is a simple overlay div:
```tsx
<div className="fixed inset-0 bg-black/50 z-[49] [-webkit-tap-highlight-color:transparent]" onClick={onClick} />
```

It is conditionally rendered: `{sidebarOpen && <SidebarBackdrop ... />}`.

### What Base UI Dialog Provides for Drawer Pattern

- **Focus trap**: Tab cycling stays within the sidebar when open on mobile
- **Escape key**: Closes the drawer without needing a custom keydown handler
- **Scroll lock**: Prevents background scrolling when drawer is open
- **`Dialog.Backdrop`**: Replaces `SidebarBackdrop` entirely
- **`aria-modal`**: Proper screen reader announcements
- **`onOpenChange` callback**: Clean state management
- **Animation support**: `data-starting-style`/`data-ending-style` for CSS transitions

### Key Design Decision: Desktop vs Mobile

The sidebar is **always visible on desktop** (static layout) and **a drawer on mobile** (overlay). Two approaches:

**Option A (Recommended): Use Dialog only on mobile, keep static sidebar on desktop.**

Wrap the sidebar in `Dialog.Root` with `open={sidebarOpen}` and `modal={false}` on desktop / `modal={true}` on mobile. Use CSS to keep the desktop sidebar static while the Dialog handles the mobile drawer behavior.

Actually, the simplest approach: use `Dialog.Root` in **controlled mode** with `open={sidebarOpen}`. On desktop, the sidebar renders inside the normal layout (the Dialog is not modal). On mobile, the Dialog adds backdrop + focus trap. Use `modal` prop dynamically based on screen width, or always use `modal` and hide the backdrop on desktop via CSS.

**Option B: Separate components for desktop and mobile.**

More complex, not recommended.

### Target State

```tsx
// Sidebar.tsx
import { Dialog } from '@base-ui/react/dialog'
import clsx from 'clsx'

export default function Sidebar({ rooms, currentRoomId, userName, isOpen, onSelectRoom, onNameChange, onSettingsClick, onClose, onInstallClick }: SidebarProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <Dialog.Portal keepMounted>
        <Dialog.Backdrop className="fixed inset-0 bg-black/50 z-[49] [-webkit-tap-highlight-color:transparent] min-[701px]:hidden" />
        <Dialog.Popup
          render={<aside />}
          className={clsx(
            'w-[260px] flex flex-col shrink-0 border-r border-sidebar-border bg-sidebar-bg text-sidebar-text pb-[env(safe-area-inset-bottom,0px)]',
            'max-[700px]:fixed max-[700px]:left-0 max-[700px]:z-50 max-[700px]:h-full',
            'max-[700px]:transition-transform max-[700px]:duration-[250ms] max-[700px]:ease-out',
            'max-[700px]:-translate-x-full max-[700px]:w-[280px] max-[700px]:max-w-[85vw]',
            isOpen && 'max-[700px]:translate-x-0'
          )}
        >
          <SidebarHeader onSettingsClick={onSettingsClick} onCloseClick={onClose} />
          <RoomList rooms={rooms} currentRoomId={currentRoomId} onSelectRoom={onSelectRoom} />
          <SidebarFooter userName={userName} onNameChange={onNameChange} onInstallClick={onInstallClick} />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
```

```tsx
// chat.tsx -- remove SidebarBackdrop import and usage
// Before:
{sidebarOpen && <SidebarBackdrop onClick={() => setSidebarOpen(false)} />}
// After: removed entirely (backdrop is now inside Sidebar via Dialog.Backdrop)
```

### Files to Change

1. `packages/worker/src/app/components/Sidebar/Sidebar.tsx` -- wrap in Dialog
2. `packages/worker/src/app/routes/chat.tsx` -- remove SidebarBackdrop usage (line 205)
3. `packages/worker/src/app/components/SidebarBackdrop/SidebarBackdrop.tsx` -- can be deleted or kept for reference

### Step-by-Step Instructions

1. Import `Dialog` from `@base-ui/react/dialog` in Sidebar.tsx
2. Wrap the `<aside>` with `Dialog.Root` in controlled mode (`open={isOpen}`, `onOpenChange`)
3. Use `Dialog.Portal` with `keepMounted` so the sidebar DOM is always present (needed for desktop layout)
4. Replace `<aside>` with `Dialog.Popup render={<aside />}` to keep semantic HTML
5. Add `Dialog.Backdrop` inside the portal, hidden on desktop with `min-[701px]:hidden`
6. In `chat.tsx`: remove `SidebarBackdrop` import and the `{sidebarOpen && <SidebarBackdrop ... />}` line
7. Consider whether `SidebarBackdrop` component can be deleted entirely (it can if no other consumer exists)
8. Test: desktop sidebar stays visible and static, mobile sidebar slides in with backdrop, Escape closes, focus trap works on mobile

### Considerations

- **`keepMounted`** is essential -- without it, the sidebar DOM disappears when closed, breaking the desktop layout where it's always visible
- **`modal` prop**: May need to be `false` to avoid scroll lock on desktop. Investigate whether `modal={'trap-focus'}` or a media-query-driven approach works best. If `modal={true}` causes scroll lock on desktop, set `modal={false}` and accept no focus trap (current behavior), or use a media query hook.
- **`render` prop on Popup**: Using `render={<aside />}` preserves the semantic `<aside>` element

### Risk Assessment

**Medium risk.**
- The dual desktop-static / mobile-drawer pattern is unusual for Dialog and needs careful testing
- `keepMounted` + controlled mode is required to maintain desktop layout
- `modal` behavior must not break desktop scroll/interaction
- Must verify CSS transitions still work with Dialog's open/close lifecycle
- Mobile keyboard (e.g., name edit in SidebarFooter) must not be disrupted by focus trap
- Touch gestures: no current swipe-to-close, so no regression risk there

---

## Migration 3: Dialog (drawer) for TeamSidebar

### Current Implementation

**Files:**
- `packages/worker/src/app/components/TeamSidebar/TeamSidebar.tsx`
- `packages/worker/src/app/routes/chat.tsx` (lines 106, 207-217)

**State management** in `ChatLayout`:
```tsx
const [teamSidebarOpen, setTeamSidebarOpen] = useState(false)
// ...
<TeamSidebar
  teamInfo={teamInfo}
  tasksInfo={tasksInfo}
  isOpen={teamSidebarOpen}
  onClose={() => setTeamSidebarOpen(false)}
/>
// Backdrop is a separate inline div OUTSIDE the flex container:
<div
  className={`fixed inset-0 z-49 bg-black/50 ${teamSidebarOpen ? 'block' : 'hidden'}`}
  onClick={() => setTeamSidebarOpen(false)}
/>
```

**TeamSidebar** uses CSS translate for mobile drawer (right side, `max-[768px]`):
```tsx
<div className={clsx(
  'w-[330px] shrink-0 flex flex-col bg-sidebar-bg text-sidebar-text border-l border-sidebar-border overflow-y-auto',
  'max-[768px]:fixed max-[768px]:right-0 max-[768px]:z-50 max-[768px]:h-full',
  'max-[768px]:transition-transform max-[768px]:duration-[250ms] max-[768px]:ease-out',
  'max-[768px]:w-[330px] max-[768px]:max-w-[85vw]',
  isOpen ? 'max-[768px]:translate-x-0' : 'max-[768px]:translate-x-full'
)}>
```

**Key differences from Sidebar migration:**
- Slides from the **right** (not left)
- Breakpoint is **768px** (not 700px)
- Backdrop is an **inline div in chat.tsx** (not a separate component)
- The backdrop div uses `z-49` (one less than the sidebar's `z-50`) and `block`/`hidden` toggle instead of conditional rendering
- Has a close button that's `hidden` on desktop, `flex` on mobile (`max-[768px]:flex`)

### Target State

```tsx
// TeamSidebar.tsx
import { Dialog } from '@base-ui/react/dialog'
import clsx from 'clsx'

export default function TeamSidebar({ teamInfo, tasksInfo, isOpen, onClose }: TeamSidebarProps) {
  const activeCount = teamInfo?.members.filter(m => m.status === 'active').length ?? 0
  const totalCount = teamInfo?.members.length ?? 0

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <Dialog.Portal keepMounted>
        <Dialog.Backdrop className="fixed inset-0 bg-black/50 z-49 min-[769px]:hidden" />
        <Dialog.Popup
          className={clsx(
            'w-[330px] shrink-0 flex flex-col bg-sidebar-bg text-sidebar-text border-l border-sidebar-border overflow-y-auto',
            'max-[768px]:fixed max-[768px]:right-0 max-[768px]:z-50 max-[768px]:h-full',
            'max-[768px]:transition-transform max-[768px]:duration-[250ms] max-[768px]:ease-out',
            'max-[768px]:w-[330px] max-[768px]:max-w-[85vw]',
            isOpen ? 'max-[768px]:translate-x-0' : 'max-[768px]:translate-x-full'
          )}
        >
          <div className="px-4 font-bold text-sm border-b border-sidebar-border flex items-center justify-between h-14 shrink-0">
            <span>Team</span>
            <span className="text-xs font-normal opacity-50">{teamInfo ? `${activeCount}/${totalCount}` : ''}</span>
            <Dialog.Close className="hidden bg-transparent border-none text-sidebar-text cursor-pointer text-[22px] p-1 rounded leading-none opacity-70 hover:opacity-100 hover:bg-hover-item max-[768px]:flex max-[768px]:items-center max-[768px]:justify-center">
              &times;
            </Dialog.Close>
          </div>
          {teamInfo && <TeamSidebarContent teamInfo={teamInfo} tasksInfo={tasksInfo} />}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
```

```tsx
// chat.tsx -- remove the inline backdrop div (lines 214-217)
// Before:
<div
  className={`fixed inset-0 z-49 bg-black/50 ${teamSidebarOpen ? 'block' : 'hidden'}`}
  onClick={() => setTeamSidebarOpen(false)}
/>
// After: removed entirely
```

### Files to Change

1. `packages/worker/src/app/components/TeamSidebar/TeamSidebar.tsx` -- wrap in Dialog
2. `packages/worker/src/app/routes/chat.tsx` -- remove inline backdrop div (lines 214-217)

### Step-by-Step Instructions

1. Import `Dialog` from `@base-ui/react/dialog` in TeamSidebar.tsx
2. Wrap the outer `<div>` with `Dialog.Root` in controlled mode
3. Use `Dialog.Portal` with `keepMounted`
4. Replace the outer `<div>` with `Dialog.Popup` keeping all existing classes
5. Add `Dialog.Backdrop` inside the portal, hidden on desktop with `min-[769px]:hidden`
6. Replace the close `<button>` with `Dialog.Close` (preserving all classes)
7. In `chat.tsx`: remove the inline backdrop div (lines 214-217)
8. Test: desktop sidebar stays visible, mobile slides from right with backdrop, Escape closes

### Risk Assessment

**Medium risk.**
- Same desktop-static / mobile-drawer dual behavior as Sidebar migration
- Same `keepMounted` + `modal` considerations
- The close button replacement with `Dialog.Close` should be straightforward
- Must verify the backdrop z-index layering still works correctly (z-49 backdrop, z-50 panel)
- TeamSidebarContent is read-only (no inputs), so focus trap is less of a concern than with Sidebar

---

## Migration Order

### Recommended order: 1 → 2 → 3

1. **KeyExistingState AlertDialog** -- simplest, self-contained, no layout implications. Good warmup to verify Base UI AlertDialog works in the app.
2. **Sidebar + SidebarBackdrop Dialog** -- more complex due to desktop/mobile dual behavior. Establishes the drawer-via-Dialog pattern that Migration 3 reuses.
3. **TeamSidebar Dialog** -- mirrors Migration 2's pattern (right side instead of left). The pattern is proven by this point.

Migrations 2 and 3 could be done in parallel since they touch different components, but doing 2 first establishes the pattern.

### Dependencies

- Migration 2 removes `SidebarBackdrop` component -- no other migrations depend on it
- Migration 3 removes the inline backdrop in `chat.tsx` -- independent of Migration 2's changes to the same file (different lines)
- If done in the same PR, both Migrations 2 and 3 modify `chat.tsx` so they should be coordinated

---

## Estimated Effort

| Migration | Effort | Notes |
|-----------|--------|-------|
| 1. AlertDialog (KeyExistingState) | ~30 min | Simple swap, one file |
| 2. Dialog drawer (Sidebar) | ~1-2 hours | Desktop/mobile dual behavior needs testing |
| 3. Dialog drawer (TeamSidebar) | ~45 min | Follows pattern from Migration 2 |
| **Total** | **~2.5-3.5 hours** | |

---

## Open Questions

1. **`modal` prop strategy for drawer migrations**: Should we use `modal={true}` (full focus trap + scroll lock) and hide backdrop on desktop via CSS? Or use a `useMediaQuery` hook to toggle `modal` between desktop/mobile? Need to test whether `modal={true}` with `keepMounted` causes issues on desktop.
2. **Should the KeyExistingState confirmation remain inline or become a proper modal overlay?** The AlertDialog is technically a modal, which changes the UX from an inline card to a centered overlay. This may be an improvement (more attention-grabbing) but is a visual change.
3. **Can SidebarBackdrop component be fully deleted?** Need to confirm no other file imports it.
