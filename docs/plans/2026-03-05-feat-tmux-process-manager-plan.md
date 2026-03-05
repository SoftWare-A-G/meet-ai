---
title: "feat: tmux-based Process Manager with lazydocker-style TUI"
type: feat
status: active
date: 2026-03-05
origin: docs/brainstorms/2026-03-05-tmux-process-manager-brainstorm.md
---

# feat: tmux-based Process Manager with lazydocker-style TUI

## Overview

Replace the current `@xterm/headless` + macOS `script -q /dev/null` stack with native **tmux sessions**. Each Claude agent room gets its own tmux session on an isolated named server (`tmux -L meet-ai`). The TUI becomes a lazydocker-style management interface: sidebar with session list, main pane showing live output, and the ability to attach to any session for full interactive control.

(see brainstorm: `docs/brainstorms/2026-03-05-tmux-process-manager-brainstorm.md`)

## Problem Statement / Motivation

The current `ProcessManager` has three fundamental limitations:

1. **macOS-only**: Uses `/usr/bin/script -q /dev/null` for PTY allocation, which doesn't exist on Linux
2. **No session persistence**: If the CLI crashes, all Claude sessions are lost
3. **No interactive access**: Users cannot type into running Claude sessions or handle unhandled permission prompts

tmux solves all three while also eliminating the `@xterm/headless` dependency (~85 lines of SGR parsing code) and enabling new capabilities like detach/reattach and `send-keys`.

## Proposed Solution

### Architecture

```
Current:  spawn() -> script (PTY) -> claude -> stdout -> @xterm/headless -> team.lines
Proposed: spawn() -> tmux new-session -> claude (inside tmux) -> capture-pane -> team.lines
```

All tmux commands go through an isolated named server: `tmux -L meet-ai`.

### Resolved Design Decisions (from brainstorm)

| Decision | Choice | Rationale |
|---|---|---|
| tmux server | Named: `tmux -L meet-ai` | Complete isolation from user's sessions |
| Layout | Single focus (lazydocker-style) | Better readability, scales to many sessions |
| Scrollback | 10,000 lines | Handles long Claude sessions |
| Orphaned sessions | Prompt user | User decides whether to reconnect or kill |
| Framework | Keep Ink v6 | tmux eliminates Ink's weaknesses (scroll, raw input) |
| Target runtime | Node.js >=22 | Same as current CLI |
| Target platforms | macOS + Linux | Same as Claude Code |

### Resolved SpecFlow Gaps

These gaps were identified during flow analysis and need to be addressed in implementation:

**1. Keybinding collision (`k` for navigation AND kill)**
- **Resolution:** `j/k` for sidebar navigation, `x` for kill (with confirmation). Current `k`-for-kill behavior changes.

**2. tmux pane behavior when Claude exits**
- **Resolution:** Set `remain-on-exit on` per session. Exited panes stay open so the user can review output. Status shown as `[done]` in sidebar.

**3. Orphan session room name resolution**
- **Resolution:** Store a local session registry at `~/.meet-ai/sessions.json` mapping `mai-<roomId>` to `{ roomId, roomName, createdAt }`. Updated on spawn, read on reconnect. Cheaper than adding a new API endpoint.

**4. `CLAUDECODE` environment variable stripping**
- **Resolution:** Spawn Claude inside tmux via wrapper: `env -u CLAUDECODE claude ...` with `DISABLE_AUTOUPDATER=1`. This ensures the nested-session detection variable is removed.

**5. Capture-pane strategy for 200ms polling**
- **Resolution:** Capture last `paneHeight` lines only (not full scrollback). Use `tmux capture-pane -t <session> -p -e -S -<N>` where N = main pane visible height + scroll offset. Scroll keys adjust the offset. `G` returns to bottom (auto-follow).

**6. Ctrl+C during attach mode**
- **Resolution:** Display a banner before attaching: `"Attached to <roomName>. Detach: Ctrl+B D | Ctrl+C sends to Claude session"`. Accepted risk — users who know tmux expect this behavior.

**7. `spawnSync` blocking event loop during attach**
- **Resolution:** Accepted. The TUI is explicitly suspended. Lobby WebSocket may time out — on resume, re-poll `list-sessions` to discover any sessions spawned while attached. WebSocket reconnection is already handled by the lobby listener.

**8. tmux pane size management**
- **Resolution:** On spawn and on terminal resize, set tmux window size to match main pane dimensions: `tmux resize-window -t mai-<roomId> -x <cols> -y <rows>`. Accept that Claude output may re-wrap on resize.

**9. Minimum tmux version**
- **Resolution:** Require tmux >= 3.2 (for `-e` environment flag). Check on startup with `tmux -V`, parse version, exit with install instructions if too old.

**10. Multiple CLI instances**
- **Resolution:** Out of scope for v1. Named server is shared; concurrent use works for read operations (capture-pane). Send-keys interleaving is a known limitation. Document this.

## Technical Considerations

### System-Wide Impact

- **Interaction graph:** `dashboard` command -> `ProcessManager` -> tmux commands -> Claude sessions. Lobby WebSocket -> `processManager.spawn()`. TUI components -> `processManager.list()`/`capture()`.
- **Error propagation:** tmux command failures (`execFileSync` throws) are caught in TmuxClient, returned as `{ ok: false, error }`. ProcessManager translates to `team.status = 'error'`. TUI shows error icon.
- **State lifecycle risks:** CLI crash leaves orphaned tmux sessions (by design -- this is a feature). Session registry (`~/.meet-ai/sessions.json`) could become stale -- reconcile against `list-sessions` on startup.
- **API surface parity:** No API changes needed. ProcessManager's public interface (`spawn`, `list`, `get`, `kill`, `killAll`) stays the same. New methods added: `capture`, `sendKeys`, `attach`, `reconnect`.

### Performance

- **Polling cost:** `tmux capture-pane` via `execFileSync` every 200ms for the focused session. Each call spawns a process (~5ms on macOS). Acceptable for 1 focused + N background sessions at 2s polling.
- **Memory:** No `@xterm/headless` Terminal instances in memory. tmux manages all buffers server-side. Node.js only holds the last captured `string[]`.
- **Bundle size:** Removing `@xterm/headless` reduces the CLI bundle.

### Security

- tmux socket at `/tmp/tmux-<uid>/meet-ai` has user-only permissions (tmux default). Only the owning user can attach.
- Sessions run `claude --dangerously-skip-permissions` -- same as current behavior, no change in risk profile.
- `CLAUDECODE` env var is stripped to prevent nested-session detection.
- All tmux commands use `execFileSync` (not `exec`) to prevent shell injection.

## Research Insights (from deepen-plan)

**Deepened on:** 2026-03-05
**Agents used:** TypeScript reviewer, Architecture strategist, Performance oracle, Security sentinel, Code simplicity reviewer, Pattern recognition specialist, Frontend race conditions reviewer

### v1 Scope Simplifications (from Simplicity Review)

Defer to v2 — the `attach` command already provides full interactive access and scrollback:
- **InputBar + sendKeys** — users press `a` to attach for interactive access. Removes ~60 lines, `input` mode, and `i` keybinding.
- **Scroll offset / Page Up / Page Down / G** — always auto-follow (show last N lines). Users who need scrollback press `a` to use tmux native scrollback. Removes ~40 lines.
- **Per-session orphan management** — two options only: "Reconnect all" or "Kill all". Inline ~20 lines in `usecase.ts` instead of dedicated OrphanPrompt component.
- **Dynamic `resizeWindow`** — set window size once at spawn. No resize event handler.
- **SessionRegistry as separate class** — inline 3-4 helper functions into ProcessManager (~15 lines vs ~110 lines).
- **Background 2s polling timer** — use single `listSessions()` call on focus switch instead.

### Critical Security Fixes (from Security Review)

1. **Use `--` separator in `newSession`** to pass command args directly, avoiding shell interpretation. Change `TmuxClient.newSession` to accept `string[]` args, not a command string.
2. **Don't pass credentials via `-e` command-line flags** (visible in `ps`). Use `tmux set-environment -g` on the named server instead.
3. **Validate session names** — enforce `^[a-zA-Z0-9_-]+$` pattern in TmuxClient.
4. **Secure registry directory** — create `~/.meet-ai/` with `0o700`, verify not a symlink, use unique temp file names.
5. **Environment allowlist** — instead of stripping just `CLAUDECODE`, pass only `HOME`, `USER`, `SHELL`, `PATH`, `TERM`, `LANG`, `MEET_AI_URL`, `MEET_AI_KEY`, `DISABLE_AUTOUPDATER`.

### Performance Optimizations (from Performance Review)

1. **Async `capturePane`** — use `execFile` (callback-based) instead of `execFileSync` for the hot-path 200ms poll. Unblocks event loop during tmux response.
2. **Batch status polling** — single `listSessions()` call on focus switch replaces N per-session `pollSession()` calls.
3. **Dirty-checking re-renders** — only update React state if captured lines actually changed (compare last line + length).
4. **Cap capture window** — use `-E` flag in `capture-pane` to capture exactly `paneHeight` lines regardless of offset.

### Race Condition Fixes (from Frontend Review)

1. **Use ref for focusedRoomId** — polling interval reads `focusedRoomRef.current`, not stale React state. Immediate capture on focus change.
2. **Mode ref for synchronous gating** — prevent batched keypresses from triggering multiple mode transitions.
3. **Return last known lines on capture failure** — don't flash blank when session dies between polls.
4. **Delay lobby WebSocket** until after orphan prompt resolves — prevents spawn requests during startup from creating inconsistent state.
5. **Close lobby WebSocket before attach** — intentionally close (not keep alive during block). Reconnect on detach resume.

### Pattern Compliance (from Pattern Recognition)

1. **Add Zod schema** for `SessionEntry[]` — consistent with `configSchema`, `SpawnRequestSchema` patterns.
2. **Preserve existing fields** — keep `onStatusChange`, `debug`, `spawned` counter in ProcessManager.
3. **Use default exports** for new PascalCase folder components per `.claude/rules/frontend/components.md`.
4. **Use discriminated union** for TmuxResult: `{ ok: true; output: string } | { ok: false; error: string }`.

## Implementation Phases

### Phase 1: TmuxClient abstraction

A low-level class that wraps all tmux CLI interactions. Isolates tmux-specific logic, enables testing with mocks. Uses `execFileSync('tmux', [...args])` for all operations (no shell injection risk).

**New file:** `packages/cli/src/lib/tmux-client.ts`

```typescript
interface TmuxResult {
  ok: boolean
  output: string
  error?: string
}

interface TmuxSessionInfo {
  name: string
  activity: number  // unix timestamp of last activity
  alive: boolean    // whether the pane command is still running
}

class TmuxClient {
  private server: string  // 'meet-ai'
  private scrollback: number  // 10_000

  // Lifecycle
  checkAvailability(): { available: boolean; version: string | null; error?: string }
  newSession(name: string, command: string, env?: Record<string, string>): TmuxResult
  killSession(name: string): TmuxResult
  killServer(): TmuxResult
  listSessions(): TmuxSessionInfo[]
  hasSession(name: string): boolean

  // I/O
  capturePane(name: string, lines: number, offset?: number): string[]
  sendKeys(name: string, text: string): TmuxResult

  // Interactive
  attachSession(name: string): number  // returns exit code of spawnSync

  // Window management
  resizeWindow(name: string, cols: number, rows: number): TmuxResult

  // Internal
  private execFile(args: string[]): TmuxResult  // uses execFileSync, no shell
}
```

**Key implementation details:**
- All commands prefixed with `-L meet-ai`
- `newSession` sets `remain-on-exit on` and `history-limit 10000`
- `capturePane` uses `-p -e -S -<lines>` (ANSI colors, last N lines)
- `execFile` wraps `child_process.execFileSync` with try/catch, returns `TmuxResult`
- `attachSession` uses `child_process.spawnSync` with `stdio: 'inherit'`
- `listSessions` parses `-F "#{session_name}\t#{session_activity}\t#{pane_dead}"` format
- `sendKeys` uses `-l` flag for literal text (prevents tmux key interpretation issues)

**Tests:** `packages/cli/test/tmux-client.test.ts`
- Unit tests with `dryRun` mode (tracks commands without executing)
- Command construction tests (verify correct args for each method)

---

### Phase 2: Session Registry

A simple JSON file at `~/.meet-ai/sessions.json` that maps tmux session names to room metadata. Enables orphan reconnection with human-readable names.

**New file:** `packages/cli/src/lib/session-registry.ts`

```typescript
interface SessionEntry {
  sessionName: string   // 'mai-<roomId>'
  roomId: string
  roomName: string
  createdAt: string     // ISO timestamp
}

class SessionRegistry {
  private filePath: string  // ~/.meet-ai/sessions.json

  load(): SessionEntry[]
  save(entries: SessionEntry[]): void
  add(entry: SessionEntry): void
  remove(sessionName: string): void
  get(sessionName: string): SessionEntry | undefined
}
```

**Key implementation details:**
- Directory created on first write (`mkdir -p ~/.meet-ai`)
- Atomic writes (write to `.tmp`, rename)
- Graceful handling of missing/corrupt file (return empty array)

**Tests:** `packages/cli/test/session-registry.test.ts`
- CRUD operations on a temp file
- Corrupt file handling
- Missing file handling

---

### Phase 3: ProcessManager rewrite

Replace all xterm-headless and `script` code with TmuxClient calls. Preserve the existing public interface (`spawn`, `list`, `get`, `kill`, `killAll`) and add new methods.

**Modified file:** `packages/cli/src/lib/process-manager.ts`

**What gets removed (~180 lines):**
- `import { Terminal, IBufferCell, IBufferLine } from '@xterm/headless'`
- `rgbComponents()`, `cellSgr()`, `rowToAnsi()` functions (lines 33-128)
- `syncLines()` method (lines 140-162)
- `this.terminals: Map<string, Terminal>` (line 132)
- `script -q /dev/null` spawn logic (lines 214-231)
- stdout -> `term.write()` -> `syncLines()` pipeline (lines 239-247)
- Terminal disposal in exit/error handlers

**Also in this phase:** Remove `@xterm/headless` from `packages/cli/package.json` (`bun remove @xterm/headless`). The dependency is no longer used after this rewrite.

**What gets added:**
```typescript
class ProcessManager {
  private tmux: TmuxClient
  private registry: SessionRegistry

  // Existing (modified implementation)
  spawn(roomId: string, roomName: string): TeamProcess
  get(roomId: string): TeamProcess | undefined
  list(): TeamProcess[]
  kill(roomId: string): void
  killAll(): void
  addError(roomId: string, roomName: string, message: string): void

  // New methods
  capture(roomId: string, lines: number, offset?: number): string[]
  sendKeys(roomId: string, text: string): void
  attach(roomId: string): void
  reconnect(): TeamProcess[]  // find and adopt orphaned sessions

  // Internal
  private pollSession(roomId: string): void  // check if session still alive
  private sessionName(roomId: string): string  // returns 'mai-<roomId>'
}
```

**`spawn()` changes:**
```typescript
// Before:
const child = spawn('/usr/bin/script', ['-q', '/dev/null', claudePath, ...args], { ... })
child.stdout.on('data', chunk => { term.write(chunk); syncLines(team) })

// After:
const sessionName = `mai-${roomId}`
// Note: tmux new-session takes a shell command string (not execFile array),
// so this string is passed to tmux which runs it in a shell inside the PTY.
// The args are constructed internally (not user input), so this is safe.
const command = `env -u CLAUDECODE ${this.opts.claudePath} ${args.join(' ')}`
this.tmux.newSession(sessionName, command, this.opts.env)
this.registry.add({ sessionName, roomId, roomName, createdAt: new Date().toISOString() })
```

**`TeamProcess` interface changes:**
```typescript
interface TeamProcess {
  roomId: string
  roomName: string
  sessionName: string   // NEW: 'mai-<roomId>'
  pid: number | null     // now optional, from tmux session info
  process: null           // always null (no ChildProcess handle)
  status: ProcessStatus
  exitCode: number | null
  lines: string[]        // populated by capture(), not syncLines()
}
```

**`capture()` replaces continuous `syncLines()`:**
- Called by TUI on poll interval (200ms for focused, 2s for background)
- Returns `tmux capture-pane` output as `string[]`
- Updates `team.lines` in place
- Also checks session liveness: if pane is dead, sets `team.status = 'exited'`

**`reconnect()` flow:**
1. Call `tmux.listSessions()` to find all `mai-*` sessions
2. Cross-reference with `registry.load()` to get room names
3. For unknown sessions (not in registry), show session name only
4. Return `TeamProcess[]` for found sessions (status derived from tmux info)

**Tests:** `packages/cli/test/process-manager.test.ts`
- Existing `dryRun` tests updated for new API
- New tests for `capture`, `sendKeys`, `reconnect`
- TmuxClient can be injected (constructor option) for mocking

---

### Phase 4: lazydocker-style TUI

Redesign the Ink TUI from horizontal split panes to a two-column layout with sidebar + main content.

**Modified files:**

#### `packages/cli/src/tui/app.tsx`
- **New state:** `mode: 'nav' | 'input' | 'attach'`, `scrollOffset: number`
- **New keybindings:**
  - `j`/`Down`: navigate sidebar down
  - `k`/`Up`: navigate sidebar up
  - `a`/`Enter`: attach to focused session (calls `processManager.attach()`)
  - `i`: enter input mode
  - `x`: kill focused session (with confirmation)
  - `n`: spawn new session (existing dialog flow)
  - `q`: quit TUI
  - `Page Up`/`Page Down`: scroll main pane
  - `G`: scroll to bottom (reset auto-follow)
- **Polling logic change:** Call `processManager.capture(focusedRoomId, mainPaneHeight, scrollOffset)` every 200ms. Background sessions polled at 2s with just `pollSession()` for status.
- **Attach flow:** Set mode to `attach`, call `processManager.attach(roomId)` (synchronous -- blocks until detach), on return set mode back to `nav`, re-poll all sessions.

#### `packages/cli/src/tui/dashboard.tsx` -> complete rewrite
- **Before:** Horizontal `<Box flexDirection="row">` with N `<Pane>` components
- **After:** Two-column layout:

```
<Box flexDirection="row">
  <Sidebar sessions={teams} focusedIndex={focusedIndex} width={sidebarWidth} />
  <MainPane lines={focusedTeam.lines} roomName={focusedTeam.roomName} status={focusedTeam.status} />
</Box>
```

#### New file: `packages/cli/src/tui/Sidebar/Sidebar.tsx`
- Scrollable list of sessions
- Each item shows: status icon + room name (truncated) + last activity
- Focused item highlighted with color
- Scrolls when focused item goes off-screen

```typescript
interface SidebarProps {
  sessions: TeamProcess[]
  focusedIndex: number
  width: number
  height: number
}
```

#### New file: `packages/cli/src/tui/MainPane/MainPane.tsx`
- Replaces `Pane` for the single focused session
- Shows room name + status in header
- Renders `lines: string[]` with ANSI passthrough via `<Text>`
- Shows scroll position indicator when not at bottom
- Shows `[no output yet]` placeholder for empty sessions

```typescript
interface MainPaneProps {
  roomName: string
  status: ProcessStatus
  lines: string[]
  scrollOffset: number
  isAutoFollow: boolean
}
```

#### New file: `packages/cli/src/tui/InputBar/InputBar.tsx`
- Appears at bottom when mode === 'input'
- Text input field with cursor
- Enter sends via `processManager.sendKeys()`
- Escape returns to nav mode

```typescript
interface InputBarProps {
  onSubmit: (text: string) => void
  onCancel: () => void
}
```

#### Modified: `packages/cli/src/tui/status-bar.tsx`
- Updated keybinding hints: `[j/k]nav [a]ttach [i]nput [x]kill [n]ew [q]uit`
- Shows focused room name
- Shows scroll position when scrolled: `Line 45/1200`
- Shows attach banner when in attach mode

#### Removed: `packages/cli/src/tui/pane.tsx`
- No longer needed (replaced by Sidebar + MainPane). Delete in this phase.

---

### Phase 5: Startup flow (availability check + orphan reconnection)

**Modified file:** `packages/cli/src/commands/dashboard/usecase.ts`

Before creating the ProcessManager and rendering the TUI:

```typescript
// 1. Check tmux availability
const tmux = new TmuxClient({ server: 'meet-ai', scrollback: 10_000 })
const check = tmux.checkAvailability()
if (!check.available) {
  console.error('tmux is required but not found.')
  console.error('Install: brew install tmux (macOS) or apt install tmux (Linux)')
  process.exit(1)
}
if (parseVersion(check.version) < [3, 2]) {
  console.error(`tmux >= 3.2 required, found ${check.version}`)
  process.exit(1)
}

// 2. Check for orphaned sessions
const orphans = processManager.reconnect()
if (orphans.length > 0) {
  // Render OrphanPrompt Ink component before the main dashboard.
  // Shows list of sessions, user selects: reconnect all / kill all / choose per session.
  // On completion, adopted sessions appear in the dashboard sidebar.
}

// 3. Launch TUI
```

**New file:** `packages/cli/src/tui/OrphanPrompt/OrphanPrompt.tsx`
- Lists orphaned sessions with room names (from registry)
- Options per session: reconnect / kill
- Bulk actions: reconnect all / kill all
- Renders before the main dashboard

---

### Phase 6: Verification

After all phases, verify the complete implementation:

```bash
cd packages/cli && bun run build && bun test && bun run typecheck && bun run lint
```

No new dependencies should appear in `package.json`. `@xterm/headless` should be gone (removed in Phase 3). `pane.tsx` should be gone (removed in Phase 4).

## Acceptance Criteria

### Functional Requirements

- [ ] `tmux -L meet-ai` named server used for all session management
- [ ] `tmux new-session` replaces `script -q /dev/null` for PTY allocation
- [ ] `tmux capture-pane -p -e` replaces `@xterm/headless` for output capture
- [ ] Sessions persist after CLI exit (quit with `q`)
- [ ] Sessions survive CLI crash and are discoverable on restart
- [ ] Orphaned session prompt on CLI startup
- [ ] Session registry at `~/.meet-ai/sessions.json`
- [ ] Sidebar shows session list with status icons and room names
- [ ] Main pane shows focused session output with ANSI colors
- [ ] `j/k` navigates sidebar
- [ ] `a` or `Enter` attaches to focused session (full interactive TTY)
- [ ] `Ctrl+B D` detaches from attached session, returns to TUI
- [ ] `i` enters input mode, text sent via `tmux send-keys`
- [ ] `x` kills focused session (with confirmation)
- [ ] `n` spawns new session (existing dialog flow)
- [ ] `q` quits TUI (sessions keep running)
- [ ] Page Up/Down scrolls main pane output
- [ ] `G` returns to bottom (auto-follow)
- [ ] tmux availability check on startup (>= 3.2)
- [ ] `CLAUDECODE` env var stripped from tmux sessions
- [ ] `remain-on-exit on` preserves output of completed sessions
- [ ] `@xterm/headless` dependency removed from `package.json`
- [ ] Works on macOS and Linux

### Non-Functional Requirements

- [ ] Focused session polled at 200ms, background at 2s
- [ ] No new npm dependencies (tmux + Node.js builtins only)
- [ ] CLI bundle size decreases (xterm-headless removed)
- [ ] All existing tests pass (updated for new API)
- [ ] New tests for TmuxClient, SessionRegistry, ProcessManager
- [ ] `bun run typecheck` passes
- [ ] `bun run lint` passes

## File Change Summary

| File | Action | Lines (est.) |
|---|---|---|
| `packages/cli/src/lib/tmux-client.ts` | **Create** | ~150 |
| `packages/cli/src/lib/session-registry.ts` | **Create** | ~60 |
| `packages/cli/src/lib/process-manager.ts` | **Rewrite** | ~180 (from 341) |
| `packages/cli/src/tui/Sidebar/Sidebar.tsx` | **Create** | ~60 |
| `packages/cli/src/tui/Sidebar/index.ts` | **Create** | ~1 |
| `packages/cli/src/tui/MainPane/MainPane.tsx` | **Create** | ~50 |
| `packages/cli/src/tui/MainPane/index.ts` | **Create** | ~1 |
| `packages/cli/src/tui/InputBar/InputBar.tsx` | **Create** | ~45 |
| `packages/cli/src/tui/InputBar/index.ts` | **Create** | ~1 |
| `packages/cli/src/tui/OrphanPrompt/OrphanPrompt.tsx` | **Create** | ~70 |
| `packages/cli/src/tui/OrphanPrompt/index.ts` | **Create** | ~1 |
| `packages/cli/src/tui/app.tsx` | **Modify** | major changes |
| `packages/cli/src/tui/dashboard.tsx` | **Rewrite** | ~30 (from 39) |
| `packages/cli/src/tui/status-bar.tsx` | **Modify** | update hints |
| `packages/cli/src/tui/pane.tsx` | **Delete** | -47 |
| `packages/cli/src/commands/dashboard/usecase.ts` | **Modify** | add startup flow |
| `packages/cli/package.json` | **Modify** | remove @xterm/headless |
| `packages/cli/test/tmux-client.test.ts` | **Create** | ~80 |
| `packages/cli/test/session-registry.test.ts` | **Create** | ~50 |
| `packages/cli/test/process-manager.test.ts` | **Modify** | update for new API |

Cleanup is integrated: `@xterm/headless` removed in Phase 3, `pane.tsx` deleted in Phase 4. No separate cleanup phase.

**Net change:** ~180 lines removed (xterm code), ~600 lines added. But the xterm SGR parsing (~85 lines) is replaced by a single `tmux capture-pane` call, so the codebase gets simpler overall.

## Dependencies and Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| tmux not installed on user's machine | Medium | Blocks usage | Clear error message + install instructions |
| tmux version too old (<3.2) | Low | Degraded functionality | Version check on startup |
| `capture-pane -e` output doesn't match Ink `<Text>` ANSI rendering | Low | Garbled colors | Test early in Phase 1; fallback to no-color capture |
| `spawnSync` for attach blocks WebSocket | Expected | Lobby events missed | Re-poll on resume (documented in resolved gaps) |
| Session registry file corruption | Low | Orphan names lost | Graceful fallback to session IDs; reconcile with `list-sessions` |
| Claude output re-wraps on `resize-window` | Medium | Visual artifacts | Accepted trade-off; Claude handles resize via SIGWINCH |

## Sources and References

### Origin

- **Brainstorm document:** [docs/brainstorms/2026-03-05-tmux-process-manager-brainstorm.md](docs/brainstorms/2026-03-05-tmux-process-manager-brainstorm.md)
  - Key decisions: named server, single-focus layout, 10K scrollback, prompt for orphans
  - lazydocker architecture patterns applied: two-column layout, ticker polling, UI suspension for attach

### Internal References

- Current ProcessManager: `packages/cli/src/lib/process-manager.ts`
- TUI components: `packages/cli/src/tui/`
- Dashboard command: `packages/cli/src/commands/dashboard/usecase.ts`
- Existing tests: `packages/cli/test/process-manager.test.ts`

### External References

- lazydocker architecture: two-column layout, 200ms ticker, Docker SDK streaming
- lazygit patterns: UI suspension for subprocess, context stack for keybindings
- tmux man page: `capture-pane`, `send-keys`, `new-session`, `list-sessions` flags
