# This is instructions for Claude Code

## Runtime, package manager
USE `bun` INSTEAD OF `npm`, `bunx` instead of `npx`

## Bun shortcuts

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts
import { test, expect } from 'bun:test'

test('hello world', () => {
  expect(1).toBe(1)
})
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.mdx`.

**Exception:** `packages/worker` uses vitest (not bun:test) because `@cloudflare/vitest-pool-workers` is the only way to test inside the Workers runtime with D1/DO bindings. The pool-workers package requires vitest@3 — vitest@4 is not supported yet.

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

The meet-ai server must be running at localhost:3000 before starting a team. See the `meet-ai-team-chat` skill in `.claude/skills/` for the full procedure.
