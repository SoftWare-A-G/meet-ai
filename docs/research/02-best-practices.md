# CLI Best Practices Research

> Agent: cli-bestpractices-researcher
> Date: 2025-02-21
> Task: Research best practices for building Node.js/Bun CLI tools

---

## 1. Code Organization

### Recommendation: Keep it mostly together, split strategically

Our CLI is ~810 lines across 4 source files. Do NOT over-engineer the structure.

**Key pattern (from gh CLI, Heroku CLI):** Separate "what command was invoked" (dispatch) from "what the command does" (implementation).

> ### DECISION (Owner: @isnifer, 2026-02-21)
>
> **OVERRIDE: Use per-command directories for expandable architecture.**
>
> Each command gets its own directory under `src/commands/`:
> ```
> src/
>   index.ts                    # Entry point: citty main command with subCommands
>   client.ts                   # HTTP + WebSocket client (keep)
>   config.ts                   # Config resolution (keep)
>   inbox-router.ts             # Inbox routing (keep)
>   spawner.ts                  # Agent spawning (keep)
>   commands/
>     create-room/
>       usecase.ts              # Business logic + zod validation
>       usecase.test.ts         # Unit tests for usecase
>       command.ts              # citty defineCommand binding
>     send-message/
>       usecase.ts
>       usecase.test.ts
>       command.ts
>     listen/
>       usecase.ts
>       usecase.test.ts
>       command.ts
>     poll/
>       ...
> ```
>
> **Why:** Expandable from day one. Each command is self-contained with its usecase (logic + zod), test, and citty binding. Zod is the validation wall and source of truth. Tests target usecases first, then integration tests pass args through CLI interface.

---

## 2. Error Handling

### Exit Code Conventions

| Code | Meaning | Use for |
|------|---------|---------|
| 0 | Success | Everything worked |
| 1 | General error | Runtime failures |
| 2 | Usage error | Bad flags, missing args |

> **IMPLEMENTED:** Using citty defaults (exit code 1 for all errors). Exit code 2 was considered but deferred — citty handles errors internally and no consumers check specific codes.

**Practical pattern:**
```typescript
function die(message: string, hint?: string): never {
  console.error(`error: ${message}`);
  if (hint) console.error(`hint: ${hint}`);
  process.exit(1);
}

function dieUsage(message: string, usage: string): never {
  console.error(`error: ${message}`);
  console.error(`usage: meet-ai ${usage}`);
  process.exit(2);
}
```

### Dual-audience error formatting (agents + humans)
```typescript
const IS_MACHINE = !process.stderr.isTTY || process.env.MEET_AI_JSON === "1";

function reportError(message: string, details?: Record<string, unknown>) {
  if (IS_MACHINE) {
    console.error(JSON.stringify({ event: "error", message, ...details }));
  } else {
    console.error(`error: ${message}`);
  }
}
```

### Error handling principles (from lirantal/nodejs-cli-apps-best-practices):
1. **Trackable errors**: Include error codes users can reference
2. **Actionable errors**: Tell users what to do next ("Run `meet-ai create-room` first")
3. **Fail fast on missing config**: Check config validity per-command
4. **Wrap unexpected errors**: Top-level try/catch that formats nicely vs raw stack traces

---

## 3. Output Formatting

### Colors

> **DECISION:** YES to colors. Low overhead but with beautiful output. Pick a lightweight library (ansis preferred) or use raw ANSI codes.

If we ever need a library: **ansis** (5.7 KB, ESM+CJS, chaining syntax) > picocolors (CJS only) > chalk (44 KB).

Minimal raw ANSI approach (zero deps):
```typescript
const isTTY = process.stderr.isTTY && !process.env.NO_COLOR;
const green = (s: string) => isTTY ? `\x1b[32m${s}\x1b[0m` : s;
const red = (s: string) => isTTY ? `\x1b[31m${s}\x1b[0m` : s;
const dim = (s: string) => isTTY ? `\x1b[2m${s}\x1b[0m` : s;
```

### Structured output for machine consumption
- Add a `--json` flag to data-returning commands
- JSON Lines for streaming (one JSON object per line) - already doing this
- Flat keys (`sender_type` not `sender.type`) - easier to pipe to `jq`

### stdout vs stderr (from clig.dev + 12-Factor)
- **stdout**: Primary data output (piped, captured)
- **stderr**: Status messages, progress, errors, debug info

> **DECISION:** YES. Review current WS message routing (currently some messages go to stderr behind-the-scenes). Ensure the split is intentional and consistent.

### Spinners: Skip them

> **DECISION:** SKIP. Not needed.

Primary consumer is AI agents running non-interactively.

---

## 4. Testing CLI Tools

### Stick with bun:test
Fast, zero-config, zero deps. Reserve vitest for `packages/worker` only.

### What to test by category:
1. **Arg parsing** - extract parseFlags, test in isolation
2. **HTTP client methods** - mock fetch with `spyOn(globalThis, "fetch")`
3. **Command integration** - spawn CLI as subprocess, assert on stdout/stderr/exit code
4. **WebSocket** - use `Bun.serve()` as mock WS server or a FakeWebSocket class
5. **Snapshot testing** - for `--help` text stability

---

## 5. Documentation Patterns

### --help structure (top-level):
```
meet-ai - CLI for meet-ai chat rooms

Usage: meet-ai <command> [options]

Commands:
  create-room     Create a new chat room
  send-message    Send a message to a room
  listen          Stream messages via WebSocket
  poll            Poll for new messages
  ...

Options:
  --help          Show help for a command
  --version       Show version number

Examples:
  meet-ai create-room "my-room"
  meet-ai send-message <room-id> bot "Hello world"
  meet-ai listen <room-id>

Environment:
  MEET_AI_URL     API base URL (default: https://meet-ai.cc)
  MEET_AI_KEY     API authentication key (required)
```

### Key rules (from clig.dev, BetterCLI.org):
- Lead with 1-2 examples
- Show most-used commands first
- Use `<required>` and `[optional]` brackets
- Keep descriptions to one line each
- Mention environment variables

> **DECISION:** YES. Also:
> - Up-to-date examples of what each command expects as input in CLI README.md
> - Produce standard-schema as output for agents to use for self-correction on wrong calls

---

## 6. Logging

### Three-level pattern:
```
quiet  (-q)     : Only errors
default         : Errors + results + brief status
verbose (-v)    : Errors + results + status + debug info
```

### Implementation:
```typescript
const QUIET = process.argv.includes("-q") || process.argv.includes("--quiet");
const VERBOSE = process.argv.includes("-v") || process.argv.includes("--verbose");

const log = {
  error: (msg: string) => console.error(`error: ${msg}`),
  info: (msg: string) => { if (!QUIET) console.error(msg); },
  debug: (msg: string) => { if (VERBOSE) console.error(`[debug] ${msg}`); },
};
```

All logging goes to **stderr** (stdout is for data).

---

## 7. Security

### API key handling:
1. **Never accept API keys as CLI flags** - leaks to shell history. Env-var-only is correct.
2. **Mask keys in debug output**: `mai_...90ab`
3. **Validate key format early**: reject keys not starting with `mai_`

### Keep minimal deps:
Every dependency is an attack surface. We now allow citty + zod as runtime deps (both well-maintained, widely used). Keep the dep count minimal beyond these.

> **DECISION:** ALL security recommendations approved. API key masking, format validation, no keys as CLI flags.

---

## Priority Actions (ranked by impact-to-effort)

1. Replace hand-rolled `parseFlags` with **citty** + **zod** validation
2. Restructure into per-command directories (`commands/<name>/usecase.ts`, `command.ts`, `usecase.test.ts`)
3. Add proper `--help` at top level with examples and env var docs (citty auto-generates this)
4. Standardize error output with `die()` / `dieUsage()` helpers and consistent exit codes (integrate with citty error handling)
5. Split stdout (data) from stderr (status) consistently; review WS message routing
6. Add `--json` flag to data-returning commands
7. Add `--verbose` / `-v` flag for debug output
8. Write usecase unit tests first, then integration tests via CLI subprocess
9. Add README.md with up-to-date examples for each command
10. Produce standard-schema output for agent self-correction
11. Add colors (lightweight, ansis or raw ANSI)
12. Add short flags (`-r` for `--room`, etc.) — additive, no breaking changes
