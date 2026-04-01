# better-result Adoption Research

**Date:** 2026-04-01
**Author:** pi
**Library:** [better-result v2.7.0](https://github.com/dmmulroy/better-result)

---

## 1. Current Usage in the Codebase

`better-result` is used exclusively in `packages/domain` and `packages/cli/src/commands/hook/` (the adapter implementations).

### Features we use (5 of 17+)

| Feature | Where | Notes |
|---------|-------|-------|
| `Result.ok()` / `Result.err()` | All domain usecases, all repository interfaces | Core construction |
| `Result.try({ try, catch })` | `ProcessTaskSync`, `ProcessPermissionReview`, `ProcessQuestionReview`, `ProcessPlanReview` | Safe `JSON.parse` wrapping |
| `.isOk()` / `.isErr()` | All 4 usecases, all CLI command handlers | Type-narrowing control flow |
| `.unwrap()` | Tests only (`ProcessPermissionReview.test.ts`, etc.) | Assertion convenience |
| `TaggedError()` | `entities/errors/` — 7 classes: `ParseError`, `ValidationError`, `TimeoutError`, `NotifyError`, `ReviewCreateError`, `ReviewPollError`, `RoomResolveError`, `TaskUpsertError` | Discriminated error types |

### Files importing `better-result` (23 total)

- **Domain package (13):** all usecases, repositories, adapters, services, error definitions
- **CLI hook adapters (5):** `HookReviewRepository`, `HookQuestionReviewRepository`, `HookPlanReviewRepository`, `SessionRoomResolver`, `HookTransportAdapter`
- **Domain tests (4):** one per usecase
- **Worker package (0):** no usage at all

---

## 2. Domain Migration Candidates

### What can move into the domain package next

#### Tier 1 — High value, low risk

**A. Shared entity schemas (Room, Message, Project)**

Room, Message, and Project types are duplicated between `packages/cli/src/types.ts` and `packages/worker/src/lib/types.ts`. These are pure data definitions that belong in domain.

```
packages/domain/src/entities/room.ts      — RoomSchema, Room type
packages/domain/src/entities/message.ts   — MessageSchema, Message type
packages/domain/src/entities/project.ts   — ProjectSchema, Project type
```

**B. HTTP error types as TaggedErrors**

The worker routes repeat `c.json({ error: 'room not found' }, 404)` dozens of times. The CLI's `HttpTransport` throws raw `Error` objects. Both would benefit from shared tagged errors:

```ts
class HttpNotFoundError extends TaggedError('HttpNotFoundError')<{ resource: string; id: string }>() {}
class HttpAuthError extends TaggedError('HttpAuthError')<{ message: string }>() {}
class HttpConflictError extends TaggedError('HttpConflictError')<{ message: string }>() {}
```

**C. "Room guard" pattern as domain logic**

Every worker route handler does:
```ts
const room = await db.findRoom(roomId, keyId)
if (!room) return c.json({ error: 'room not found' }, 404)
```
This is domain validation — could be a reusable `RoomGuard` or validation function returning `Result<Room, HttpNotFoundError>`.

#### Tier 2 — Medium value

**D. CLI domain usecases adopting Result**

The CLI's `packages/cli/src/domain/usecases/` has 15+ use cases (`CreateRoom`, `SendMessage`, `DeleteRoom`, `Listen`, `Poll`, etc.) that all return bare `Promise<T>` and propagate thrown errors. These should return `Result` types for consistency with the hook usecases.

**E. CLI repository interfaces returning Result**

`IRoomRepository`, `IMessageRepository`, `IProjectRepository`, `IAttachmentRepository` — all return bare promises. Should be `Promise<Result<T, E>>` to match the domain pattern.

**F. Generalize IHookTransport**

Currently only has `sendTimeoutMessage`. The worker routes do the same "broadcast via DO" pattern repeatedly. A general `IRoomMessenger` interface could live in domain.

#### Tier 3 — Future consideration

**G. Worker route handlers as thin adapters over domain usecases**

Currently the Hono routes contain business logic (creating UUIDs, inserting messages, broadcasting via DO). The domain layer could own these flows, with routes being thin HTTP adapters.

**H. Shared polling logic**

The 3 review repositories in the CLI (`HookReviewRepository`, `HookQuestionReviewRepository`, `HookPlanReviewRepository`) all implement identical polling loops. This could be extracted into a domain-level `PollUntilDecided` utility.

---

## 3. Unused better-result Features

### 🔴 HIGH priority — immediate value

#### `Result.gen()` + `Result.await()` — Generator-based composition

**Impact:** Eliminates ~40% of boilerplate in all 4 domain usecases.

Every usecase has the same repetitive pattern:
```ts
// Current: 12 lines of boilerplate per usecase
const parsed = this.parseInput(rawInput)
if (parsed.isErr()) return parsed
const input = parsed.value

const roomResult = await this.roomResolver.findRoomForSession(input.session_id)
if (roomResult.isErr()) return roomResult
const roomId = roomResult.value

const reviewResult = await this.repo.createReview(roomId, ...)
if (reviewResult.isErr()) return reviewResult
const review = reviewResult.value
```

With `Result.gen`:
```ts
// Proposed: 5 lines, same type safety
return Result.gen(async function* () {
  const input = yield* Result.await(self.parseInput(rawInput))
  const roomId = yield* Result.await(self.roomResolver.findRoomForSession(input.session_id))
  const review = yield* Result.await(self.repo.createReview(roomId, ...))
  return self.resolveOutput(review)
})
```

The error types are automatically collected into a union — identical behavior to the current code but without manual threading.

#### `Result.tryPromise()` — Async try/catch with built-in retry

**Impact:** Replaces the hand-rolled `withRetry()` in `packages/cli/src/domain/adapters/HttpTransport.ts`.

Current CLI code:
```ts
// 25-line hand-rolled retry function
export async function withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T> {
  const maxRetries = options?.maxRetries ?? 3
  const baseDelay = options?.baseDelay ?? 1000
  // ...exponential backoff loop
}
```

With `Result.tryPromise`:
```ts
const result = await Result.tryPromise(
  { try: () => fetch(url), catch: e => new HttpError({ cause: e }) },
  { retry: { times: 3, delayMs: 1000, backoff: 'exponential' } }
)
```

Also supports `shouldRetry` predicate for selective retry based on error type.

### 🟡 MEDIUM priority — cleaner patterns

#### `.match()` — Pattern matching on Result

**Where:** `resolveDecisionOutput()` in `ProcessPermissionReview` and `ProcessPlanReview`.

Current:
```ts
if (status === 'approved') return Result.ok({ ... })
if (status === 'denied') return Result.ok({ ... })
return Result.ok(null)
```

This is already clean, but `.match()` shines when you need to handle Ok/Err branches:
```ts
return decisionResult.match({
  ok: decision => this.resolveOutput(decision),
  err: error => this.handlePollFailure(error, roomId, reviewId),
})
```

#### `.andThen()` / `.andThenAsync()` — Chaining without generators

**Where:** Short 2-step chains where `Result.gen` is overkill.

```ts
// Instead of:
const parsed = this.parseInput(raw)
if (parsed.isErr()) return parsed
return this.validate(parsed.value)

// Use:
return this.parseInput(raw).andThen(input => this.validate(input))
```

#### `matchError()` — Exhaustive error handling at boundaries

**Where:** CLI command handlers that currently do `log(result.error._tag + result.error.message)`.

```ts
// Current (non-exhaustive):
if (result.isErr()) {
  log(`${result.error._tag}: ${result.error.message}`)
}

// Proposed (exhaustive — compiler catches missing cases):
matchError(result.error, {
  ParseError: e => log(`Bad input: ${e.message}`),
  ValidationError: e => log(`Invalid ${e.field}: ${e.message}`),
  TimeoutError: e => log(`Timed out: ${e.message}`),
  ReviewCreateError: e => log(`Create failed: ${e.message}`),
  ReviewPollError: e => log(`Poll failed: ${e.message}`),
  RoomResolveError: e => log(`Room not found: ${e.message}`),
})
```

### 🟢 LOW priority — nice to have

| Feature | Use case | Notes |
|---------|----------|-------|
| `.map()` / `.mapError()` | Transform values in pipelines | Useful with `andThen` chains |
| `.tap()` / `.tapAsync()` | Logging side effects (e.g., the `void await expire()` pattern) | Formalizes fire-and-forget |
| `Result.partition()` | Batch processing (e.g., multiple tasks) | Future use if batch ops added |
| `Result.serialize()` / `Result.deserialize()` | WebSocket/HTTP transport between CLI ↔ Worker | Could replace ad-hoc JSON parsing |
| `.unwrapOr()` | Default value extraction | Cleaner than `result.isOk() ? result.value : fallback` |
| `Result.flatten()` | Nested `Result<Result<T, E1>, E2>` unwrapping | Edge case utility |

---

## 4. Recommended Action Plan

### Phase 1: Refactor existing domain usecases (low risk, high impact)
1. Adopt `Result.gen` in all 4 usecases to eliminate `if/isErr/return` boilerplate
2. Use `matchError` in CLI command handlers for exhaustive error logging
3. Add `.andThen()` for short chains in parse+validate steps

### Phase 2: Extract shared entities into domain (medium risk)
4. Move Room, Message, Project schemas into `packages/domain/src/entities/`
5. Create shared HTTP error TaggedError classes
6. Extract the repeated polling loop into a domain utility

### Phase 3: CLI domain migration (larger effort)
7. Adopt `Result.tryPromise` in `HttpTransport` to replace `withRetry`
8. Update CLI repository interfaces to return `Result` types
9. Update CLI usecases to return `Result` types

### Phase 4: Worker integration (largest effort)
10. Use `Result.serialize`/`deserialize` at the HTTP boundary
11. Extract worker route business logic into domain usecases
12. Routes become thin HTTP adapters calling domain layer
