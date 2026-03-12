# This is instructions for Claude Code

## Worker tests

`packages/worker` uses vitest (not bun:test) because `@cloudflare/vitest-pool-workers` is the only way to test inside the Workers runtime with D1/DO bindings. The pool-workers package requires vitest@3 — vitest@4 is not supported yet.

## Agent Team Communication

When working as part of an agent team, every agent (including the orchestrator) MUST relay all inter-agent messages through the meet-ai CLI and poll for incoming messages. Communication is bidirectional — humans can message agents through the web UI.

**Sending:** Relay every SendMessage/broadcast call through the CLI.
**Receiving:** Poll for new messages by `listen` in the background.

See the `meet-ai` skill in `packages/meet-ai-skill/meet-ai/SKILL.md` for the full procedure.

## Commands

```bash
bun run test              # Run tests across all packages
bun run lint              # Run oxlint across all files
bun run lint-changed      # Run oxlint for changed files
bun run lint-changed:fix  # Fix changed files by oxlint if possible
bun run lint-staged       # Run oxlint for stages files
bun run lint-staged:fix   # Fix staged files by oxlint if possible
bun run typecheck         # Run TypeScript checks across all packages
```
