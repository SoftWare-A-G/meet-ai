# CLI Staged Review - Follow-up Decisions

Date: 2026-02-21  
Base review: `docs/reviews/cli-staged-review-2026-02-21.md`

## Decision Log

1. WebSocket auth token in URL query (`client.ts`)  
Status: **Deferred**  
Reason: will be addressed in a coordinated CLI + worker change set.

2. Exit code policy (`1` vs `2` for usage/validation)  
Status: **Declined**  
Reason: keep `citty` default behavior and conventions instead of overriding to research recommendation.

3. `download-attachment` filename handling and duplicated `<id>-<id>` fallback  
Status: **Must Fix**  
Required:
- Stop passing attachment id as filename placeholder.
- Resolve filename from server metadata/headers where available.
- Ensure output path uses a meaningful filename fallback strategy.
- Add/adjust tests for filename resolution and fallback behavior.

4. Missing CLI subprocess integration tests  
Status: **Must Implement**  
Required:
- Add integration tests that execute CLI commands via subprocess.
- Cover at least: success path, usage/validation failure path, and API failure path.
- Validate `stdout`, `stderr`, and exit code behavior per current `citty`-based policy.

## Next Acceptance Criteria

- `download-attachment` no longer writes files as `<attachmentId>-<attachmentId>` except as explicit final fallback.
- New integration test suite runs in CI and fails on regressions in command wiring/output/exit behavior.
