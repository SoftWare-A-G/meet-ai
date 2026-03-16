# This is instructions for Claude Code

## Worker tests

`packages/worker` uses vitest (not bun:test) because `@cloudflare/vitest-pool-workers` is the only way to test inside the Workers runtime with D1/DO bindings. The pool-workers package now supports vitest@4, and vite 8 requires `@cloudflare/vite-plugin >= 1.29.0`.

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
