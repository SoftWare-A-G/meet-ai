---
date: 2026-03-05
topic: tmux-process-manager
---

# tmux-based Process Manager (lazydocker-style TUI)

## What We're Building

Replace the current `@xterm/headless` + macOS `script -q /dev/null` stack with native **tmux sessions**. Each Claude agent room gets its own tmux session. The TUI becomes a lazydocker-style management interface: sidebar with session list, main pane showing live output, and the ability to attach to any session for full interactive control.

**Target runtime:** Node.js (>=22)
**Target platforms:** macOS + Linux (same as Claude Code)

## Current Architecture

```
spawn() -> script -q /dev/null (PTY, macOS-only)
         -> claude --dangerously-skip-permissions ...
         -> stdout -> @xterm/headless (ANSI parser)
         -> team.lines: string[]
         -> Ink <Pane> renders lines
```

**Problems:**
- `script -q /dev/null` is macOS-only
- `@xterm/headless` is a 3rd-party dependency doing what tmux does natively
- No session persistence (crash = lost session)
- No interactive input to Claude sessions
- No way to attach/detach from a running session

## Proposed Architecture

```
spawn() -> tmux -L meet-ai new-session -d -s mai-<roomId> claude ...
read()  -> tmux -L meet-ai capture-pane -t mai-<roomId> -p -S - (full scrollback)
input() -> tmux -L meet-ai send-keys -t mai-<roomId> "text" Enter
kill()  -> tmux -L meet-ai kill-session -t mai-<roomId>
attach  -> suspend TUI, tmux -L meet-ai attach -t mai-<roomId>, resume on detach
list()  -> tmux -L meet-ai list-sessions -F "#{session_name} #{session_activity}"
```

## Why tmux

| Concern | Current (script + xterm-headless) | tmux |
|---|---|---|
| PTY allocation | macOS `script` only | Cross-platform (macOS + Linux) |
| Terminal emulation | @xterm/headless (JS, ~200 lines of SGR parsing) | Built-in, battle-tested |
| Session persistence | None (crash = lost) | Survives CLI crash, reattachable |
| Interactive input | Not possible | `send-keys` or `attach` |
| Live debugging | Must read through TUI | `tmux attach` from any terminal |
| Dependencies | @xterm/headless (npm) | tmux (system, pre-installed on most Linux) |
| Scrollback | Manual buffer management | Native, configurable |

## lazydocker Architecture Patterns (applied to our case)

Research into lazygit/lazydocker reveals these key patterns:

### 1. Two-Column Layout
- **Left:** Session list (name, status icon, resource usage)
- **Right:** Live output of focused session (captured via `tmux capture-pane`)
- lazydocker uses a fixed split; lazygit has NORMAL/HALF/FULL screen modes

### 2. Input Model — Context Stack
- **Navigation mode:** Arrow keys move between sessions, hotkeys for actions
- **Action mode:** Popup menus/dialogs for create/kill/configure
- **Interactive mode:** UI suspension — hand terminal to `tmux attach`, resume on detach
- This is exactly how lazygit handles `git rebase -i` — suspend TUI, launch editor, resume

### 3. Live Output — Ticker Pattern
- lazydocker polls Docker API every 200ms and rewrites the main pane
- We poll `tmux capture-pane` on a similar interval
- On focus change, immediately capture the new session's pane

### 4. Process Tracking
- lazydocker: `ContainerList` poll (1s) + Docker event stream
- We use: `tmux list-sessions` poll + exit detection via `tmux wait-for`

## TUI Framework Decision

### Evaluated Frameworks

| Framework | Panel Layout | Scroll | Interactive PTY | Node.js | Maintained | Downloads/wk |
|---|---|---|---|---|---|---|
| **Ink v6** | Yes (Flexbox) | No built-in | Partial (raw mode conflict) | Yes | Active | 2.3M |
| **blessed** | Yes (absolute) | Yes | Yes (node-pty) | Yes | Dead (11yr) | 1.4M |
| **terminal-kit** | Manual | Manual | Partial | Yes | Slow | 227k |
| **OpenTUI** | Yes (Yoga) | Yes | Partial | Bun-only | Very active | 111k |

### Decision: Ink (keep, with tmux workaround)

**With tmux as the backend, Ink's two biggest weaknesses disappear:**

1. **Scrolling** — tmux handles scrollback natively. We just capture the visible portion via `capture-pane` with line range flags. Arrow keys adjust the capture range.

2. **Interactive input conflict** — We don't need raw input passthrough. Two options:
   - **Light interaction:** Forward keystrokes via `tmux send-keys` (no raw mode conflict)
   - **Full interaction:** Suspend Ink, run `tmux attach`, resume on detach (lazygit pattern)

**Why not switch frameworks:**
- Ink is already in the project, team knows it
- The tmux backend eliminates the problems that would justify a switch
- blessed is dead, terminal-kit is too low-level, OpenTUI is Bun-only
- No framework change = smaller PR, less risk

## Key Design Decisions

### Session Naming Convention
`mai-<roomId>` prefix for all tmux sessions. This allows:
- Easy filtering: `tmux list-sessions -f "#{m:mai-*,#{session_name}}"`
- No collision with user's own tmux sessions
- Clear ownership identification

### Output Capture Strategy
```bash
# Capture visible pane content (what user would see)
tmux capture-pane -t mai-<roomId> -p

# Capture full scrollback history
tmux capture-pane -t mai-<roomId> -p -S -

# Capture with ANSI colors preserved
tmux capture-pane -t mai-<roomId> -p -e
```

Poll interval: **200ms** (matches lazydocker pattern). Only poll the focused session at this rate; background sessions poll at 2s or on-demand.

### Interactive Input (two tiers)

**Tier 1 — send-keys (in-TUI, no mode switch):**
- User presses `i` to enter input mode on focused session
- Text input box appears at bottom (like lazygit's command input)
- On Enter, send via `tmux send-keys -t mai-<roomId> "text" Enter`
- Press Escape to return to navigation mode
- Good for: quick commands, answering prompts

**Tier 2 — attach (full takeover, lazygit suspend pattern):**
- User presses `Enter` or `a` to attach to focused session
- Ink TUI suspends (`process.stdout.write('\x1b[?1049l')` to exit alt screen)
- `child_process.spawnSync('tmux', ['attach', '-t', 'mai-<roomId>'])` takes over
- User interacts with Claude directly, full TTY
- `Ctrl+B D` detaches, returns to Ink TUI
- Good for: debugging, complex interaction, watching output live

### Session Lifecycle

```
┌─ CLI spawns ─────────────────────────────────────────────┐
│                                                          │
│  create room -> tmux new-session -d -s mai-<roomId>      │
│                 claude --dangerously-skip-permissions ... │
│                                                          │
│  TUI polls   -> tmux capture-pane -t mai-<roomId> -p -e  │
│                                                          │
│  user input  -> tmux send-keys -t mai-<roomId> "..." En  │
│                                                          │
│  user attach -> suspend TUI, tmux attach, resume         │
│                                                          │
│  kill        -> tmux kill-session -t mai-<roomId>         │
│                                                          │
│  crash/exit  -> sessions survive! reattach on restart     │
│                                                          │
│  cleanup     -> tmux kill-server (or kill matching sess)  │
└──────────────────────────────────────────────────────────┘
```

### Reconnection on CLI Restart
When the CLI starts, check for existing `mai-*` sessions:
```bash
tmux list-sessions -F "#{session_name}" | grep "^mai-"
```
Offer to reconnect to orphaned sessions or kill them.

### Environment Passthrough
tmux inherits the spawning shell's environment. To pass `MEET_AI_URL`, `MEET_AI_KEY`, etc:
```bash
tmux new-session -d -s mai-<roomId> -e "MEET_AI_URL=..." -e "MEET_AI_KEY=..." claude ...
```

### tmux Availability Check
On CLI startup:
```bash
which tmux && tmux -V
```
If missing, print: `"tmux is required. Install: brew install tmux (macOS) or apt install tmux (Linux)"`

## ProcessManager API Changes

```typescript
// Before
class ProcessManager {
  spawn(roomId, roomName): TeamProcess     // script + xterm-headless
  private syncLines(team): void            // read xterm buffer
  get(roomId): TeamProcess
  list(): TeamProcess[]
  kill(roomId): void
  killAll(): void
}

// After
class ProcessManager {
  spawn(roomId, roomName): TeamProcess     // tmux new-session
  capture(roomId): string[]                // tmux capture-pane
  sendKeys(roomId, text): void             // tmux send-keys (NEW)
  attach(roomId): void                     // tmux attach + TUI suspend (NEW)
  reconnect(): TeamProcess[]               // find orphaned sessions (NEW)
  get(roomId): TeamProcess
  list(): TeamProcess[]
  kill(roomId): void
  killAll(): void
}
```

## TUI Layout (lazydocker-style)

```
┌─────────────────────────────────────────────────────────┐
│ meet-ai dashboard                              [?] help │
├──────────────┬──────────────────────────────────────────┤
│ Sessions     │ >>> mai-room-abc123                      │
│              │                                          │
│ > room-abc.. │ Claude is working on task...             │
│   room-def.. │ Reading file src/index.ts                │
│   room-ghi.. │ ...                                     │
│              │ I'll implement the feature now.          │
│              │                                          │
│              │                                          │
│              │                                          │
│              │                                          │
├──────────────┴──────────────────────────────────────────┤
│ [n]ew  [k]ill  [a]ttach  [i]nput  [q]uit               │
└─────────────────────────────────────────────────────────┘
```

**Keybindings:**
- `j/k` or arrows: navigate session list
- `n`: create new session (prompt for room name)
- `k` or `x`: kill focused session
- `a` or `Enter`: attach to focused session (full interactive)
- `i`: input mode (type command, send via send-keys)
- `q`: quit TUI (sessions keep running)
- `+/-`: resize sidebar

## What Gets Removed

- `@xterm/headless` dependency from `package.json`
- All xterm-related code in `process-manager.ts`:
  - `Terminal` import and usage
  - `cellSgr()`, `rowToAnsi()` helper functions (~80 lines)
  - `syncLines()` method
  - `this.terminals` Map
- `script -q /dev/null` spawn pattern

## Resolved Decisions

1. **tmux server scope**: **Named server** (`tmux -L meet-ai`). Complete isolation from user's personal tmux sessions. Clean `tmux -L meet-ai kill-server` for full cleanup.
2. **Scrollback size**: **10,000 lines**. Handles long Claude sessions with lots of tool output.
3. **Layout**: **Single focus** (lazydocker-style). One session fills the main pane. Better readability, simpler capture, scales to many sessions.
4. **Orphaned sessions**: **Prompt user**. On CLI start, list orphaned `mai-*` sessions and ask whether to reconnect or kill each.

## Remaining Open Questions

1. **Color passthrough**: Need `tmux capture-pane -e` for ANSI colors. Does Ink's `<Text>` render these correctly? (It should — already works with xterm-headless output.)

## Next Steps

-> `/ce:plan` for implementation details
