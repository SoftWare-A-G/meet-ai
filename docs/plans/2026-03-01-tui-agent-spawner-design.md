# TUI Agent Spawner Design

**Date:** 2026-03-01
**Status:** Approved
**Branch:** feat/tui-agent-spawner

## Summary

A terminal dashboard (`meet-ai dashboard`) that spawns and displays multiple Claude Code instances in vertical panes within a single terminal tab. Each pane represents a meet-ai room with a team lead that runs its own agent team autonomously.

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  meet-ai dashboard  (ink TUI)                            │
│                                                          │
│  ┌─ fix-login ──────┬─ api-refactor ──┬─ design-sys ──┐ │
│  │ stream-json      │ stream-json     │ stream-json   │ │
│  │ parsed & rendered│ parsed & render │ parsed & rend │ │
│  └──────────────────┴─────────────────┴───────────────┘ │
│  [n]ew team  [k]ill team  [←→] focus  [q]uit            │
├──────────────────────────────────────────────────────────┤
│  ProcessManager                                          │
│  ├─ spawns: claude -p --output-format stream-json        │
│  │          --dangerously-skip-permissions "prompt"       │
│  ├─ tracks: Map<roomId, { pid, stdout, status }>         │
│  └─ cleanup: SIGTERM all on exit                         │
├──────────────────────────────────────────────────────────┤
│  Control room WebSocket (__control)                      │
│  └─ listens for spawn/kill requests from web UI          │
└──────────────────────────────────────────────────────────┘
```

### Key Pieces

1. **ink app** — React components rendering panes, status bar, keybindings
2. **ProcessManager** — spawns/tracks/kills Claude processes, parses stdout
3. **Control room** — `__control` room WebSocket for web UI commands
4. **New CLI command:** `meet-ai dashboard`

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Package location | New command in `packages/cli` | Reuses existing client, config, WebSocket infrastructure |
| TUI library | ink (React for CLI) | Familiar React DX, flexbox layout, actively maintained |
| Pane interactivity | Read-only with controls | Keybindings for spawn/kill/focus/scroll, no typing into panes |
| Output source | Pipe claude stdout (stream-json) | Real-time token-level visibility into agent work |
| Spawn triggers | Both TUI and web UI | TUI keybinding + web UI via control room WebSocket |
| Permissions | `--dangerously-skip-permissions` | Full autonomy required for unattended team operation |
| Cleanup on exit | Kill all spawned processes | SIGTERM all children, no orphaned Claude instances |
| Web UI integration | Control room (no DO changes) | Regular messages to `__control` room, parsed by TUI |

## Process Spawning & Lifecycle

### Spawning a Claude Instance

```typescript
const child = spawn(claudePath, [
  "-p",
  "--output-format", "stream-json",
  "--dangerously-skip-permissions",
  "--model", model,
  "--append-system-prompt", systemPrompt,
  prompt,
], {
  stdio: ["pipe", "pipe", "pipe"],
  env: {
    ...process.env,
    CLAUDECODE: "",
    DISABLE_AUTOUPDATER: "1",
    MEET_AI_URL: config.url,
    MEET_AI_KEY: config.key,
  },
  detached: false,
});
```

Key details:
- `CLAUDECODE` unset to avoid nested-session block
- `DISABLE_AUTOUPDATER: "1"` to prevent update prompts
- `detached: false` — children die with parent
- meet-ai config passed via env so the agent can use `meet-ai` CLI

### Process State

```typescript
Map<roomId, {
  pid: number,
  process: ChildProcess,
  status: "starting" | "running" | "exited" | "error",
  exitCode: number | null,
  lines: string[],  // rolling buffer for pane display
}>
```

### Lifecycle Events

- **spawn** → status = `starting`
- **first `message_start` event on stdout** → status = `running`
- **exit code 0** → status = `exited` (task completed)
- **exit non-zero** → status = `error`
- **TUI exit (Ctrl+C)** → SIGTERM all children, wait 3s, SIGKILL stragglers

### stdout Parsing (NDJSON)

Each line is a JSON object. We extract:
- `text_delta` → append to pane as visible text
- `content_block_start` (tool_use) → show `[tool: Read file.ts]` in pane
- Everything else → ignore or dim

## ink Component Tree

```
<App>
  ├─ <Dashboard>
  │   ├─ <Pane roomId="fix-login" focused={true}>
  │   │   ├─ <PaneHeader name="fix-login" status="running" />
  │   │   └─ <PaneOutput lines={string[]} />
  │   ├─ <Pane roomId="api-refactor" focused={false}>
  │   │   └─ ...
  │   └─ <Pane roomId="design-sys" focused={false}>
  │       └─ ...
  ├─ <StatusBar teams={3} focused="fix-login" />
  └─ <SpawnDialog visible={showSpawn} onSubmit={handleSpawn} />
```

### Components

| Component | Responsibility |
|-----------|---------------|
| `App` | Top-level: ProcessManager, control room WebSocket, keybinding handler |
| `Dashboard` | Flexbox row of panes, distributes equal width |
| `Pane` | Vertical box with header + scrollable output. Border highlight when focused |
| `PaneHeader` | Room name + status indicator (spinner/checkmark/cross) |
| `PaneOutput` | Rolling buffer of parsed lines, auto-scrolls. Scrollable when focused |
| `StatusBar` | Bottom bar: keybind hints, focused pane name, team count |
| `SpawnDialog` | Inline prompt: enter room name + task description. Triggered by `n` key |

### Keybindings

| Key | Action |
|-----|--------|
| `n` | Open SpawnDialog (new team) |
| `k` | Kill focused team (SIGTERM) |
| `←` / `→` | Move focus between panes |
| `↑` / `↓` | Scroll focused pane |
| `q` | Quit (SIGTERM all, exit) |

## Control Room Integration

### Startup

On startup, the TUI:
1. Creates (or finds) a room named `__control`
2. Joins its WebSocket
3. Listens for `spawn_request` and `kill_request` messages

### Spawn Request (Web UI → TUI)

```json
{
  "type": "spawn_request",
  "room_name": "fix-login-bug",
  "prompt": "Fix the login bug in useAuth.ts.",
  "model": "opus"
}
```

TUI receives it via `__control` WebSocket:
1. Creates the room via `meet-ai create-room "fix-login-bug"`
2. Spawns the Claude process with the prompt
3. Adds a new pane to the dashboard

### Kill Request (Web UI → TUI)

```json
{
  "type": "kill_request",
  "room_id": "abc123"
}
```

TUI SIGTERMs the process, removes the pane.

### Status Updates (TUI → Web UI)

TUI posts status back to `__control`:
- `{ "type": "team_started", "room_id": "abc123", "room_name": "fix-login" }`
- `{ "type": "team_exited", "room_id": "abc123", "exit_code": 0 }`
- `{ "type": "team_error", "room_id": "abc123", "error": "..." }`

Web UI can display running team status without any new API endpoints.

### Multi-Tenancy

`__control` is scoped to the user's API key like every other room. Each user has their own isolated control room and team rooms. The existing key-scoped architecture handles this — no special treatment needed.

Room names starting with `__` should be reserved (validated on create).

## File Structure

### New Files in `packages/cli/`

```
src/
  commands/
    dashboard/
      command.ts          # citty command definition
      usecase.ts          # orchestration: ink app + ProcessManager + control room
      schema.ts           # zod validation for spawn/kill messages
  tui/
    app.tsx               # <App> root: wires ProcessManager + WebSocket + ink
    dashboard.tsx         # <Dashboard> flexbox row of panes
    pane.tsx              # <Pane> + <PaneHeader> + <PaneOutput>
    status-bar.tsx        # <StatusBar> keybind hints
    spawn-dialog.tsx      # <SpawnDialog> inline prompt
  lib/
    process-manager.ts    # spawn/track/kill Claude processes, parse stream-json
    stream-parser.ts      # NDJSON parser: extract text_delta, tool_use, etc.
    control-room.ts       # join __control, listen for spawn/kill, post status
```

### New Dependencies

```
ink           # React for CLI
react         # peer dep of ink (already in catalog: 19.2.4)
```

Only `ink` is new. Everything else (client, config, WebSocket, `findClaudeCli`) is reused from existing CLI code.

## Command Invocation

```bash
meet-ai dashboard
```

No arguments. Creates/joins `__control`, renders the empty dashboard, waits for spawn requests from keyboard or web UI.

## Prompt Template

Each spawned Claude gets:

```
You are a team lead for room "{roomName}". Use meet-ai CLI for all communication:
- meet-ai send-message {roomId} "your-name" "message"
- meet-ai listen {roomId}
- meet-ai poll {roomId}

Your task: {userPrompt}
```

Claude then self-organizes — creates teams, spawns sub-agents, coordinates via meet-ai rooms — all autonomously.
