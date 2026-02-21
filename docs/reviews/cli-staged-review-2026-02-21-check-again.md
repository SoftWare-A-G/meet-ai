# CLI Staged Review - Check Again

Date: 2026-02-21  
Scope: latest staged + in-progress changes after follow-up decisions

## Findings

### P2 - Attachment ID should still be sanitized before writing to disk
- Files:
  - `packages/cli/src/client.ts:334`
  - `packages/cli/src/lib/attachments.ts:14`
- Current behavior:
  - Files are now written as `/tmp/meet-ai-attachments/${attachmentId}.bin`.
  - This is aligned with "we do not care about original filenames".
- Remaining risk:
  - In poll/listen attachment flows, `attachmentId` originates from server metadata and is currently trusted directly.
  - A malformed ID containing path separators could still cause unsafe paths.
- Recommendation:
  - Add a strict sanitizer/allowlist before file path construction (e.g. keep only `[a-zA-Z0-9_-]` and fallback to a safe token).

### P3 - Integration suite still misses success-path coverage for `download-attachment`
- File:
  - `packages/cli/test/integration/cli-commands.test.ts`
- Gap:
  - Integration tests cover missing-arg failure for `download-attachment` but not a successful binary download flow.
- Recommendation:
  - Add a success test that:
    - mocks `GET /api/attachments/:id` with binary response,
    - runs `meet-ai download-attachment <id>`,
    - asserts exit code `0`,
    - validates stdout includes resulting local path.

## Quick Verification

- Local/dev validation is expected to use your environment where all tests are green.
- In this Codex sandbox, socket binding is restricted, so network integration tests are not reliable as a source of truth.
