# CLI SOLID & Clean Architecture Audit

**Date:** 2026-03-07
**Scope:** `packages/cli/src/`
**Grade:** D+
**Estimated recovery:** 40-60 hours

---

## SOLID Principles

### S — Single Responsibility (VIOLATED)

- `client.ts` (516 lines) mixes HTTP, WebSocket, retry logic, file I/O, and message parsing
- `listen/usecase.ts` (220 lines) combines routing, terminal management, inbox handling, idle detection, and signal handlers
- `hook/log-tool-use/usecase.ts` (163 lines) mixes parsing, file TTL, agent detection, and diff formatting

### O — Open/Closed (PARTIAL)

- New endpoints require editing `client.ts` factory function — no extension points
- Adding a new command type means modifying existing client code rather than extending it

### L — Liskov Substitution (N/A)

- No inheritance or polymorphism patterns to evaluate

### I — Interface Segregation (VIOLATED)

- `MeetAiClient` exposes 14 methods
- `poll` command uses 1 method but depends on all 14
- Should be split into: `RoomClient`, `MessageClient`, `AttachmentClient`, `CommandClient`

### D — Dependency Inversion (VIOLATED)

- Global singleton `getClient()` in `client-factory.ts:7-13` prevents testing
- Direct `fs` imports scattered throughout (`client.ts:65`, `listen.ts:97`, `log-tool-use.ts:1`)
- High-level modules depend directly on low-level details (console, fetch, fs)

---

## Clean Architecture Assessment: POOR

- No layer separation between CLI parsing, business logic, data access, and external I/O
- `client.ts` is monolithic — HTTP, WebSocket, and file operations all in one place
- Testability breaks at the global singleton pattern
- Cannot extend without modifying existing code

---

## Top 5 Refactoring Priorities

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 1 | **Extract HTTP Layer** — Move `withRetry()` + fetch into a dedicated transport module | 2-3h | High |
| 2 | **Split MeetAiClient** — 4 domain-specific clients instead of 14-method monolith | 3-4h | High |
| 3 | **Remove singleton** — Dependency injection instead of `getClient()` | 2h | High |
| 4 | **Extract InboxRouter** — Remove ~60 lines of routing logic from `listen()` | 2h | Medium |
| 5 | **FileSystemAdapter** — Injectable FS abstraction for test isolation | 2-3h | Medium |

---

## Strengths (from initial review)

- Consistent command pattern (`command.ts` → `usecase.ts` + `schema.ts`) across all 14 commands
- 100% TypeScript + Zod validation
- Retry with backoff, timeouts, atomic file writes
- Security-first approach (input validation, safe paths, allowlist env vars)
- Comprehensive test coverage
- Minimal dependencies
