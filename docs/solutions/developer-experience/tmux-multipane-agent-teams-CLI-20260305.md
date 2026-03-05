---
module: CLI
date: 2026-03-05
problem_type: developer_experience
component: tooling
symptoms:
  - "TUI dashboard only showed team lead output, not teammate panes"
  - "tmux sessions killed on quit, preventing orphan reconnection"
root_cause: inadequate_documentation
resolution_type: code_fix
severity: medium
tags: [tmux, multi-pane, agent-teams, tui, process-manager]
---

# Troubleshooting: Claude Code Agent Teams Create Separate Tmux Panes

## Problem
When Claude Code runs as a team lead inside a tmux session and spawns agent teammates, each teammate gets its own tmux pane via split-pane mode. The TUI dashboard only captured the first pane (pane 0), making teammate output invisible. Additionally, pressing `q` called `killAll()` which destroyed all tmux sessions, making orphan reconnection impossible.

## Environment
- Module: CLI (`packages/cli`)
- Runtime: Bun + TypeScript
- Affected Components: `tmux-client.ts`, `process-manager.ts`, `MainPane.tsx`, `app.tsx`, `usecase.ts`
- Date: 2026-03-05

## Symptoms
- Dashboard main pane only showed team lead (pane 0) output
- Teammate agents were running but their output was not visible in the TUI preview
- After quitting with `q` and restarting, `reconnect()` found zero orphaned sessions
- `tmux -L meet-ai list-sessions` returned "no server running" after quit

## What Didn't Work

**Direct solution:** The problems were identified through user testing and fixed iteratively.

## Solution

### Problem 1: Multi-pane capture and grid display

Added `listPanes()` to `TmuxClient` to discover all panes in a session using `tmux list-panes -t session -F format`.

Updated `capturePane` to accept `session.paneIndex` dot notation for targeting specific panes.

Updated `ProcessManager.capture()` to discover panes and capture each in parallel using `Promise.all`.

Added `PaneCapture` type (`index`, `title`, `active`, `lines[]`) and `panes: PaneCapture[]` to `TeamProcess`.

Rewrote `MainPane` with responsive grid layouts (1-5 panes) showing "N of M panes" indicator.

### Problem 2: Session lifecycle on quit

Changed `q` to just exit the TUI without killing sessions, added `Q` for destructive kill-all-and-quit.

Removed `killAll()` from the cleanup function in `usecase.ts` so SIGINT/SIGTERM also preserves sessions.

## Why This Works

1. **Multi-pane:** Claude Code's agent team split-pane mode creates actual tmux panes (not virtual). `tmux list-panes` discovers them, and `capture-pane -t session.N` captures each independently.

2. **Session lifecycle:** tmux sessions are designed to outlive their controlling terminal. By not calling `killAll()` on quit, sessions persist on the tmux server (`tmux -L meet-ai`). On next CLI launch, `reconnect()` calls `listSessions()` and adopts any `mai-*` sessions found.

## Prevention

- **Key insight:** When spawning processes inside tmux that may create sub-panes (like Claude Code with agent teams), always check `list-panes` rather than assuming a single pane per session.
- **tmux session lifecycle:** Follow the tmux convention — detach preserves sessions, only explicit kill destroys them. `q` = detach, `Q` = kill.
- **Pane targeting syntax:** `tmux capture-pane -t sessionName.paneIndex` — the dot notation targets specific panes within a session.

## Related Issues

No related issues documented yet.
