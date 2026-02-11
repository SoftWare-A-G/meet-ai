# This is instructions for Claude Code

## Worker tests

`packages/worker` uses vitest (not bun:test) because `@cloudflare/vitest-pool-workers` is the only way to test inside the Workers runtime with D1/DO bindings. The pool-workers package requires vitest@3 — vitest@4 is not supported yet.

## meet-ai API Key in Claude Code Settings

Add `MEET_AI_KEY` and `MEET_AI_URL` via the `env` field in `settings.json`.

**User-level** (`~/.claude/settings.json`) — applies to all projects:

```json
{
  "env": {
    "MEET_AI_URL": "https://meet-ai.cc",
    "MEET_AI_KEY": "mai_YourKeyHere1234567890ab"
  }
}
```

**Project-level** (`.claude/settings.json`) — applies to this repo only:

```json
{
  "env": {
    "MEET_AI_URL": "http://localhost:8787",
    "MEET_AI_KEY": "mai_YourKeyHere1234567890ab"
  }
}
```

## Agent Team Communication

When working as part of an agent team, every agent (including the orchestrator) MUST relay all inter-agent messages through the meet-ai CLI and poll for incoming messages. Communication is bidirectional — humans can message agents through the web UI.

**Sending:** Relay every SendMessage/broadcast call through the CLI.
**Receiving:** Poll for new messages between tasks using `poll`, or run `listen` in the background.

This does NOT apply to:

- Initial task/context prompts passed when spawning teammates via the Task tool
- Internal thinking or tool usage that isn't a direct message to another agent

See the `meet-ai` skill in `packages/meet-ai-skill/meet-ai/SKILL.md` for the full procedure.

## Package Manager

Default to using Bun instead of Node.js.
More bun-related info in `./claude/docs/bun.md`

## Commands

```bash
bun run lint              # Run oxlint for all files in repo
bun run lint-changed      # Run oxlint for changed files
bun run lint-changed:fix  # Fix changed files by oxlint if possible
bun run lint-staged       # Run oxlint for stages files
bun run lint-staged:fix   # Fix staged files by oxlint if possible
bun run typecheck         # Run TypeScript checks across all packages
```
