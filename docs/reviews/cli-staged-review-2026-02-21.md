# CLI Staged Changes Review

Date: 2026-02-21  
Scope: staged changes in `packages/cli` validated against:
- `docs/research/01-cli-frameworks.md`
- `docs/research/02-best-practices.md`
- `docs/research/03-testing-patterns.md`
- `docs/research/04-code-audit.md`

## Findings

### P1 - `send-message` / `send-log` content parsing breaks with `--flag=value` before content
- Files:
  - `packages/cli/src/lib/rest-content.ts:11`
  - `packages/cli/src/commands/send-message/command.ts:36`
  - `packages/cli/src/commands/send-log/command.ts:41`
- Problem:
  - `extractRestContent()` skips the token after any flag token.
  - For `--color=red`, there is no separate flag value token, so the next positional token (actual content) is skipped.
- Repro:
  - `cd packages/cli && MEET_AI_URL=http://127.0.0.1:9 bun run src/index.ts send-message room1 bot --color=red hi`
  - Observed: `ZodError ... "Message content is required"`

### P1 - Default interactive path has unhandled async failure behavior
- File:
  - `packages/cli/src/index.ts:33`
- Problem:
  - `run()` calls `spawnInteractive()` without `await`/catch.
  - Non-zero child exit causes raw stack trace instead of controlled CLI error formatting.
- Repro:
  - Run default command with a failing `MEET_AI_CLAUDE_PATH` binary.
  - Observed: stack trace from `packages/cli/src/spawner.ts` and Bun runtime output.

### P2 - Usage errors still return exit code `1` (not `2`)
- File:
  - `packages/cli/src/index.ts:37`
- Problem:
  - Research decision in `docs/research/02-best-practices.md` says usage errors should return code `2`.
  - Current `runMain(main)` flow returns `1` for missing args/unknown command.
- Repro:
  - `cd packages/cli && bun run src/index.ts send-message`
  - Observed: `EXIT:1` with missing positional argument.

### P2 - API errors are duplicated in output
- Files:
  - `packages/cli/src/commands/create-room/usecase.ts:14`
  - `packages/cli/src/commands/create-room/usecase.ts:15`
  - `packages/cli/src/commands/send-message/usecase.ts:20`
  - `packages/cli/src/commands/send-message/usecase.ts:21`
  - Similar pattern in other usecases.
- Problem:
  - Usecases call `err(...)` and then rethrow.
  - Top-level runner also logs the thrown error.
  - Result: duplicated error lines for one failure.

### P2 - Code-audit high-priority WS auth issue remains unresolved
- File:
  - `packages/cli/src/client.ts:145`
- Problem:
  - API key is still sent in WebSocket query string (`?token=...`).
  - This is explicitly flagged as HIGH in `docs/research/04-code-audit.md`.
  - Current change only adds TODO comments, no mitigation.

## Open Questions (Resolved)

1. ~~`download-attachment` CLI contract changed from `<attachmentId>` to `<roomId> <messageId>`~~ — **Resolved:** Restored original `<attachmentId>` interface. Single positional arg.
2. ~~Should release behavior strictly enforce researched usage exit code policy (`2`), or keep citty defaults (`1`) for now?~~ — **Resolved:** Keeping citty defaults (exit code 1). No consumers check specific codes.

## Verification Run

- `cd packages/cli && bun test` -> pass (98 tests)
- `cd packages/cli && bun run typecheck` -> pass
- `cd packages/cli && bun run build` -> pass

## Resolution

All findings from this review have been addressed:

- **P1 content parsing (`--flag=value`)** — Fixed in `packages/cli/src/lib/rest-content.ts`. The `extractRestContent()` function now correctly detects `--flag=value` tokens (containing `=`) and does not skip the next token.
- **P1 default handler** — Fixed in `packages/cli/src/index.ts`. The default `run()` now properly awaits `spawnInteractive()` with error handling.
- **P2 exit codes** — Kept citty default (exit code 1 for all errors). Documented decision in `docs/research/02-best-practices.md`. No downstream consumers check specific exit codes, so exit code 2 differentiation was deferred.
- **P2 duplicate errors** — Fixed. Usecases now throw pure errors without calling `err()`. The `command.ts` catch block is the single error formatting point.
- **P2 WS auth** — Deferred per plan. TODO comment in `client.ts:143` documents the issue. Requires coordinated changes in `packages/worker` (separate PR).
- **download-attachment contract** — Restored original `<attachmentId>` single-positional interface. The `<roomId> <messageId>` mode was removed; `lib/attachments.ts` still provides `downloadMessageAttachments()` for poll/listen enrichment.
- **Exit code 2 policy** — Kept as-is (citty default of 1). No consumers check specific codes. Decision documented in best practices doc.

