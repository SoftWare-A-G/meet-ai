# Ink 7 Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the CLI dashboard from Ink 6.8.0 to Ink 7.x, replacing manual ANSI escape codes with Ink's `alternateScreen` option and adding reactive terminal resize via `useWindowSize`.

**Architecture:** Three-phase migration: compatibility spike (version bump + smoke test), terminal lifecycle migration (alternateScreen + ANSI removal), reactive sizing (useWindowSize). Each phase is one commit on `feature/ink-7`. A fourth phase covers optional follow-ups (usePaste, useFocusManager, layout props) as separate commits.

**Tech Stack:** Ink 7.x, React 19.2.4, @inkjs/ui 2.0.0, ink-link 5.0.0, Bun, TypeScript

**Spec:** `docs/plans/2026-04-12-ink-7-migration.md`

---

## File Map

| File | Phase | Action | Responsibility |
|------|-------|--------|---------------|
| `packages/cli/package.json` | 1 | Modify | Bump `ink` version |
| `packages/cli/src/commands/dashboard/usecase.ts` | 2 | Modify | Add `alternateScreen`, remove ANSI at line 141 |
| `packages/cli/src/tui/app.tsx` | 2, 3 | Modify | Remove/keep ANSI (lines 59, 258, 264), replace `useStdout` (line 51) with `useWindowSize` |
| `packages/cli/src/commands/dashboard/onboarding.tsx` | — | No change | Modals render pre-dashboard in normal screen, no alt-screen needed |
| `packages/cli/src/tui/dashboard.tsx` | 3 (conditional) | Maybe modify | Only if resize smoke test reveals issues |
| `packages/cli/src/tui/status-bar.tsx` | 3 (conditional) | Maybe modify | Only if resize smoke test reveals issues |
| `packages/cli/src/tui/MainPane/MainPane.tsx` | 3 (conditional) | Maybe modify | Only if resize smoke test reveals issues |
| `packages/cli/src/tui/Sidebar/Sidebar.tsx` | 3 (conditional) | Maybe modify | Only if resize smoke test reveals issues |

---

## Phase 1: Compatibility Spike

### Task 1: Bump Ink to 7.x

**Files:**
- Modify: `packages/cli/package.json` (line ~37, `"ink": "6.8.0"`)

- [ ] **Step 1: Check current Ink version**

Run: `grep '"ink"' packages/cli/package.json`
Expected: `"ink": "6.8.0"`

- [ ] **Step 2: Check latest Ink 7 version on npm**

Run: `bunx npm-view ink version`
If that fails, run: `bun info ink` or check https://www.npmjs.com/package/ink

- [ ] **Step 3: Update Ink version in package.json**

Edit `packages/cli/package.json` — change:
```json
"ink": "6.8.0"
```
to the latest 7.x version (e.g. `"7.0.0"`). Use a fixed version, no caret/tilde.

- [ ] **Step 4: Install dependencies**

Run: `bun install`

Verify no peer dependency conflicts in the output. Specifically check:
- `@inkjs/ui@2.0.0` peer dep on `ink`
- `ink-link@5.0.0` peer dep on `ink`

If either shows a peer warning, read the package's `package.json` on npm to check if Ink 7 is in their peer range. If not, this is the stop rule — document the incompatibility and halt.

### Task 2: Run verification suite

**Files:** None (read-only verification)

- [ ] **Step 1: Run typecheck**

Run: `bun run typecheck`
Expected: Clean pass with zero errors. If there are type errors from Ink 7 API changes, document them — they indicate breaking changes we need to address.

- [ ] **Step 2: Run tests**

Run: `bun run test`
Expected: All tests pass. If any fail, check whether failures are Ink-related or pre-existing.

- [ ] **Step 3: Run linter**

Run: `bun run lint`
Expected: Clean pass.

- [ ] **Step 4: Verify @inkjs/ui components import correctly**

Check that the 4 components we use still exist in `@inkjs/ui`:
Run: `grep -r "from '@inkjs/ui'" packages/cli/src/`

Expected imports: `ConfirmInput`, `Spinner`, `TextInput`, `Select`. If any are missing or renamed in the Ink 7 ecosystem, document and fix.

- [ ] **Step 5: Verify ink-link imports correctly**

Run: `grep -r "from 'ink-link'" packages/cli/src/`

Expected: `Link` default import in `AuthModal.tsx` and `EnvManagerModal.tsx`.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/package.json bun.lock
git commit -m "$(cat <<'EOF'
chore(cli): bump ink from 6.8.0 to 7.x

Compatibility spike for Ink 7 migration. All tests pass,
typecheck clean, @inkjs/ui and ink-link verified compatible.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2: Terminal Lifecycle Migration

### Task 3: Add `alternateScreen` to dashboard render

**Files:**
- Modify: `packages/cli/src/commands/dashboard/usecase.ts` (line 187)

- [ ] **Step 1: Read current render call**

Read `packages/cli/src/commands/dashboard/usecase.ts` around line 187 to see the exact `render()` call and its arguments.

- [ ] **Step 2: Add `alternateScreen` option**

Change the render call from:
```ts
const instance = render(element)
```
to:
```ts
const instance = render(element, { alternateScreen: true })
```

This tells Ink to manage the alternate screen buffer automatically — enter on mount, restore on exit.

- [ ] **Step 3: Remove manual ANSI cleanup in usecase.ts**

Read line 141 of `usecase.ts`. It should contain:
```ts
process.stdout.write('\x1b[?1049l')
```

Remove this line. Ink's `alternateScreen` handles restoring the normal screen on exit.

- [ ] **Step 4: Run typecheck**

Run: `bun run typecheck`
Expected: Clean pass. The `alternateScreen` option is new in Ink 7.

- [ ] **Step 5: Manual verification — dashboard launch and exit**

Run the CLI dashboard manually. Verify:
- Dashboard renders in alternate screen (normal terminal content hidden)
- Pressing `q` exits cleanly to the normal terminal (previous content restored)
- Ctrl+C also restores the terminal correctly
- No flickering or double-switch on startup

### Task 4: Remove or preserve ANSI in app.tsx attach/detach

**Files:**
- Modify: `packages/cli/src/tui/app.tsx` (lines 59, 258, 264)

**STOP RULE:** If tmux attach/detach behavior is ambiguous under Ink's `alternateScreen`, keep manual ANSI in the attach/detach path (lines 258, 264) and only remove the cleanup ANSI (line 59). Do not force full removal in this commit.

- [ ] **Step 1: Read the ANSI usage context**

Read `packages/cli/src/tui/app.tsx` around lines 55-65 and 250-270 to understand:
- Line 59: `process.stdout.write('\x1b[?1049l')` — cleanup path
- Line 258: `process.stdout.write('\x1b[?1049l')` — leave alt screen before tmux attach
- Line 264: `process.stdout.write('\x1b[?1049h')` — re-enter alt screen after tmux detach

- [ ] **Step 2: Remove cleanup ANSI (line 59)**

The cleanup ANSI at line 59 should be redundant now that Ink manages the alt screen. Remove the `process.stdout.write('\x1b[?1049l')` line in the cleanup/exit path.

- [ ] **Step 3: Test tmux attach/detach flow**

If the CLI has tmux integration, test the attach/detach cycle:
1. Launch dashboard
2. Attach to a tmux session (triggers line 258 — leaves alt screen)
3. Detach from tmux (triggers line 264 — re-enters alt screen)
4. Verify terminal state is correct after each transition

**Decision point:**
- If attach/detach works WITHOUT manual ANSI (lines 258, 264): remove them
- If attach/detach breaks WITHOUT manual ANSI: keep them, add a comment explaining why

```ts
// Manual ANSI required: Ink's alternateScreen doesn't cover mid-session
// terminal handoff to tmux. See docs/plans/2026-04-12-ink-7-migration.md
```

- [ ] **Step 4: Run typecheck and tests**

Run: `bun run typecheck && bun run test`
Expected: Clean pass.

- [ ] **Step 5: Final manual verification**

Verify the complete lifecycle:
- Dashboard launches in alt screen
- Tmux attach/detach works (terminal state correct at each step)
- Exit (`q`) restores normal terminal
- Ctrl+C restores normal terminal
- No orphaned alt screen state on crash

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/commands/dashboard/usecase.ts packages/cli/src/tui/app.tsx
git commit -m "$(cat <<'EOF'
feat(cli): migrate to Ink alternateScreen option

Replace manual ANSI escape codes (\x1b[?1049h/l) with Ink 7's
built-in alternateScreen render option. Manual ANSI kept only
for tmux attach/detach if needed (see migration spec).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3: Reactive Sizing

### Task 5: Replace `useStdout` with `useWindowSize` in app.tsx

**Files:**
- Modify: `packages/cli/src/tui/app.tsx` (lines 1, 51)

- [ ] **Step 1: Read current sizing code**

Read `packages/cli/src/tui/app.tsx` lines 1-5 (imports) and around line 51 to see exactly how `useStdout` is used for dimensions.

Current pattern:
```ts
import { Box, Text, useInput, useApp, useStdout, useStdin } from 'ink'
// ...
const { stdout } = useStdout()
// then: stdout?.rows, stdout?.columns
```

- [ ] **Step 2: Replace import**

Change the Ink import to swap `useStdout` for `useWindowSize`:
```ts
import { Box, Text, useInput, useApp, useStdin } from 'ink'
import { useWindowSize } from 'ink'
```

Or if `useWindowSize` is exported from the main `ink` module, combine:
```ts
import { Box, Text, useInput, useApp, useStdin, useWindowSize } from 'ink'
```

Check the Ink 7 source/docs to confirm the exact import path before editing.

- [ ] **Step 3: Replace hook call**

Change:
```ts
const { stdout } = useStdout()
```
to:
```ts
const { width, height } = useWindowSize()
```

Note: `useStdout` may still be needed if other code uses `stdout` for non-dimension purposes (e.g., `stdout.write`). Check all `stdout` references in app.tsx. If `stdout` is only used for `.rows`/`.columns`, remove `useStdout` entirely. If it's also used for writes, keep both hooks.

- [ ] **Step 4: Update dimension references**

Find all `stdout?.rows` and `stdout?.columns` (or `stdout.rows`/`stdout.columns`) in app.tsx and replace:
- `stdout?.rows` → `height`
- `stdout?.columns` → `width`

The `useWindowSize` hook returns reactive values that auto-update on terminal resize, so layout will re-render automatically.

- [ ] **Step 5: Run typecheck**

Run: `bun run typecheck`
Expected: Clean pass. Fix any type mismatches (e.g., `number | undefined` → `number`).

- [ ] **Step 6: Run tests**

Run: `bun run test`
Expected: All pass.

- [ ] **Step 7: Manual verification — resize behavior**

1. Launch the dashboard
2. Resize the terminal window while it's running
3. Verify layout re-renders correctly (sidebar, main pane, status bar adjust)
4. Test at very small terminal sizes — should degrade gracefully, not crash
5. Test at very large terminal sizes — should fill available space

- [ ] **Step 8: Check downstream files**

If resize testing reveals layout issues in downstream files:
- `packages/cli/src/tui/dashboard.tsx`
- `packages/cli/src/tui/status-bar.tsx`
- `packages/cli/src/tui/MainPane/MainPane.tsx`
- `packages/cli/src/tui/Sidebar/Sidebar.tsx`

Fix them in this same task. These files consume props or fixed constants, so they likely work without changes. Only modify if the smoke test shows problems.

- [ ] **Step 9: Commit**

```bash
git add packages/cli/src/tui/app.tsx
# Also add any downstream files if they were modified
git commit -m "$(cat <<'EOF'
feat(cli): use Ink useWindowSize for reactive terminal resize

Replace manual useStdout().stdout dimension reads with Ink 7's
useWindowSize hook. Dashboard layout now re-renders reactively
when the terminal is resized.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4: Optional Follow-ups

Each sub-task is its own commit. Not blocking the core Ink 7 migration.

### Task 6: Add `usePaste` to spawn-dialog

**Files:**
- Modify: `packages/cli/src/tui/spawn-dialog.tsx` (lines 2, 47)

- [ ] **Step 1: Read Ink 7 docs for `usePaste` API**

Check the Ink 7 release notes or source for the exact `usePaste` hook signature. It should enable bracketed paste mode and provide a callback for paste events.

- [ ] **Step 2: Read current text input handling**

Read `packages/cli/src/tui/spawn-dialog.tsx` around line 47 to understand how text input is currently handled character-by-character in the `useInput` handler.

- [ ] **Step 3: Add `usePaste` import and hook**

```ts
import { Box, Text, useInput, usePaste } from 'ink'
```

Add the `usePaste` hook in the component body. The hook should receive a callback that handles the pasted text atomically:
```ts
usePaste((text) => {
  // Insert the full pasted text into the input value at once
  setValue((prev) => prev + text)
})
```

Adjust the exact state setter to match the component's current state management pattern.

- [ ] **Step 4: Test paste behavior**

1. Open the spawn dialog
2. Paste a long room name or URL
3. Verify it arrives as one atomic insert, not character-by-character
4. Verify normal typing still works

- [ ] **Step 5: Run typecheck and tests**

Run: `bun run typecheck && bun run test`

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/tui/spawn-dialog.tsx
git commit -m "$(cat <<'EOF'
feat(cli): add usePaste to spawn dialog for atomic paste

Pasted room names, URLs, and other text now arrive atomically
instead of character-by-character using Ink 7's usePaste hook.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

### Task 7: Add `usePaste` to AuthModal

**Files:**
- Modify: `packages/cli/src/commands/dashboard/AuthModal.tsx` (lines 1, 28)

- [ ] **Step 1: Read current AuthModal input handling**

Read `packages/cli/src/commands/dashboard/AuthModal.tsx` around line 28 to see the `useInput` handler and any text input state.

- [ ] **Step 2: Add `usePaste` hook**

Same pattern as Task 6 — import `usePaste` from `ink`, add hook call with atomic paste handler that inserts into the auth input field.

- [ ] **Step 3: Test paste behavior**

Paste an API key or auth URL into the auth modal. Verify atomic arrival.

- [ ] **Step 4: Run typecheck and tests**

Run: `bun run typecheck && bun run test`

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/commands/dashboard/AuthModal.tsx
git commit -m "$(cat <<'EOF'
feat(cli): add usePaste to auth modal for atomic paste

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

### Task 8: Add `usePaste` to EnvManagerModal

**Files:**
- Modify: `packages/cli/src/tui/EnvManagerModal/EnvManagerModal.tsx` (lines 1, 15, 47)

- [ ] **Step 1: Read current EnvManagerModal input handling**

Read `packages/cli/src/tui/EnvManagerModal/EnvManagerModal.tsx` around line 47.

- [ ] **Step 2: Add `usePaste` hook**

Same pattern as Tasks 6-7.

- [ ] **Step 3: Test paste behavior**

Paste environment variable values. Verify atomic arrival.

- [ ] **Step 4: Run typecheck and tests**

Run: `bun run typecheck && bun run test`

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/tui/EnvManagerModal/EnvManagerModal.tsx
git commit -m "$(cat <<'EOF'
feat(cli): add usePaste to env manager modal for atomic paste

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

### Task 9: Adopt `useFocusManager` with `activeId`

**Files:**
- Modify: `packages/cli/src/tui/app.tsx`
- Modify: `packages/cli/src/tui/spawn-dialog.tsx`
- Modify: `packages/cli/src/commands/dashboard/AuthModal.tsx`
- Modify: `packages/cli/src/tui/EnvManagerModal/EnvManagerModal.tsx`

- [ ] **Step 1: Read Ink 7 docs for `useFocusManager` with `activeId`**

Check the exact API. `useFocusManager()` should return an object with `activeId` that tracks the currently focused component.

- [ ] **Step 2: Audit current focus management in app.tsx**

Read `packages/cli/src/tui/app.tsx` and find the manual `useState` for focus (e.g., `useState<'agent' | 'input' | 'list'>`). Map how focus state flows through the component and which key handlers toggle it.

- [ ] **Step 3: Replace manual focus state with `useFocusManager`**

Replace the custom `useState` focus tracking with Ink's `useFocusManager`. Add `useFocus` to each focusable component with an `id` prop. Use `activeId` to determine which component has focus.

This is a medium-effort refactor — read the full component before making changes.

- [ ] **Step 4: Apply same pattern to modals**

Repeat for `spawn-dialog.tsx`, `AuthModal.tsx`, `EnvManagerModal.tsx` — each has manual focus/tab-cycling logic that can be simplified with `useFocusManager`.

- [ ] **Step 5: Run typecheck and tests**

Run: `bun run typecheck && bun run test`

- [ ] **Step 6: Manual verification**

Test tab cycling in:
- Main dashboard (agent list, input, sidebar)
- Spawn dialog (room name, buttons)
- Auth modal (inputs, buttons)
- Env manager modal (selector, inputs, buttons)

Verify focus visuals and keyboard navigation work as before.

- [ ] **Step 7: Commit**

```bash
git add packages/cli/src/tui/app.tsx packages/cli/src/tui/spawn-dialog.tsx packages/cli/src/commands/dashboard/AuthModal.tsx packages/cli/src/tui/EnvManagerModal/EnvManagerModal.tsx
git commit -m "$(cat <<'EOF'
refactor(cli): adopt Ink useFocusManager with activeId

Replace manual useState focus tracking with Ink 7's built-in
useFocusManager. Simplifies tab-cycling logic in dashboard,
spawn dialog, and modals.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

### Task 10: Layout props and polish

**Files:**
- Modify: `packages/cli/src/tui/Sidebar/Sidebar.tsx`
- Modify: `packages/cli/src/tui/MainPane/MainPane.tsx`
- Modify: `packages/cli/src/tui/dashboard.tsx`
- Modify: `packages/cli/src/tui/status-bar.tsx`

- [ ] **Step 1: Read Ink 7 docs for new Box props**

Check available props: `maxWidth`, `maxHeight`, `aspectRatio`, `borderBackgroundColor`, `wrap="hard"`.

- [ ] **Step 2: Identify layout constraints needed**

Test the dashboard at various terminal sizes (40x20, 80x24, 120x40, 200x60). Identify where layout breaks or overflows.

- [ ] **Step 3: Apply `maxWidth`/`maxHeight` where beneficial**

Add constraints to Box components that should cap their size. For example:
- Sidebar: `maxWidth={40}` to prevent it from growing too wide
- Status bar: `maxHeight={1}` to keep it single-line

Only add constraints where testing in Step 2 revealed actual issues.

- [ ] **Step 4: Run typecheck and tests**

Run: `bun run typecheck && bun run test`

- [ ] **Step 5: Manual verification at various sizes**

Re-test at the same terminal sizes from Step 2. Verify improvements and no regressions.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/tui/Sidebar/Sidebar.tsx packages/cli/src/tui/MainPane/MainPane.tsx packages/cli/src/tui/dashboard.tsx packages/cli/src/tui/status-bar.tsx
git commit -m "$(cat <<'EOF'
feat(cli): add Ink 7 layout constraints for responsive behavior

Apply maxWidth/maxHeight to Box components for better behavior
in small terminals using Ink 7's new layout props.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```
