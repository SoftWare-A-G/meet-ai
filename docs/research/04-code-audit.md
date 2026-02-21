# CLI Code Audit Report

> Agent: cli-audit-agent
> Date: 2025-02-21
> Task: Full audit of CLI codebase - readability, security, quality, test coverage

---

## Summary by Severity

### HIGH (4 issues)
1. Monolithic 447-line switch statement in index.ts — **RESOLVED** (citty + per-command directories)
2. Unhandled top-level promise rejections — **RESOLVED** (citty `runMain` handles top-level errors; per-command try/catch in command.ts)
3. API key exposed in WebSocket URL query parameter — **DEFERRED** (TODO comment added in client.ts:143, requires coordinated worker changes, separate PR)
4. No tests for send-message and poll commands — **RESOLVED** (98 tests across 14 files, all commands covered)

### MEDIUM (11 issues)
1. Repeated usage string duplication — **RESOLVED** (citty auto-generates help/usage)
2. Duplicated --help/flag validation pattern — **RESOLVED** (citty handles uniformly)
3. download-attachment bypasses client.downloadAttachment() — **RESOLVED** (usecase calls client.downloadAttachment directly)
4. Missing .catch() on res.json() in some error paths — **RESOLVED** (consistent .catch() on error-path res.json())
5. No input sanitization on URL path parameters — **RESOLVED** (zod schemas validate all IDs with regex)
6. 9 instances of `any` type usage — partially resolved (MeetAiClient interface + types.ts exports)
7. No tests for config priority resolution — **RESOLVED** (config tests added)
8. Tests suppress console.error without restoring — **RESOLVED** (new tests use mock() with proper cleanup)
9. Tests don't restore globalThis.fetch after mocking — **RESOLVED** (new tests use mock client pattern, not globalThis.fetch)
10. appendToInbox race condition on concurrent writes — remains (low risk for single-agent usage)
11. getConfigSource() duplicates config resolution logic — **RESOLVED** (dead exports cleaned up)

### LOW (14 issues)
1. Cryptic variable name prefixes (smPos, slFlags, etc.)
2. Magic `\\n` replacement without comment
3. downloadMessageAttachments misplaced in index.ts
4. parseFlags/rejectFlagLikeArgs should be in utility module
5. generate-key missing --help and flag validation
6. Message and AttachmentMeta types not exported
7. createClient returns anonymous object type
8. Inconsistent require() vs import() for node:fs
9. Hardcoded /tmp/meet-ai-attachments path in 3 locations
10. Dead code: _originalFetch in tests, isConfigured()/getConfigSource() in config.ts
11. parseFlags silently eats valueless flags at end of args
12. Inconsistent retry wrapping
13. `this` binding fragility in listen() method
14. Error message suggests `npm` instead of `bun` in spawner.ts

---

## Detailed Findings

### index.ts

#### HIGH: Monolithic switch statement (lines 57-446)
The entire CLI is a single switch spanning ~390 lines. Each case has inline arg parsing, validation, execution, and output formatting.
**Fix:** Extract each command into its own function. Switch becomes a dispatcher.

#### HIGH: Unhandled top-level promise rejections (lines 7-10)
Config loaded and client created at module level. Every `await` runs at top level with no try/catch. If `client.createRoom()` rejects, process crashes with unhandled promise rejection.
**Fix:** Wrap switch body in try/catch that prints error and calls process.exit(1).

#### MEDIUM: Repeated usage strings
Usage string `"meet-ai create-room <room-name>"` repeated 4 times for create-room alone. Same for every command.
**Fix:** Define usage strings as constants per command.

#### MEDIUM: Duplicated --help/flag validation pattern
Every command block repeats: check --help, call parseFlags, call rejectFlagLikeArgs, validate required args, print usage, process.exit(1).
**Fix:** Command registration pattern that handles this uniformly.

#### LOW: Cryptic variable names (lines 117, 279, 284)
`smPos`, `slFlags`, `tiRoomId`, `stPayload` - two-letter prefixes to avoid redeclaration in same scope.
**Fix:** Extract commands into separate functions, use clean names.

#### LOW: Magic \\n replacement (lines 123, 285)
`.replace(/\\n/g, '\n')` without explanation.
**Fix:** Add comment or extract to `unescapeNewlines()` helper.

#### LOW: downloadMessageAttachments misplaced (lines 14-31)
Network I/O + file ops function in CLI entry point. Belongs in client.ts.

#### LOW: parseFlags/rejectFlagLikeArgs (lines 33-55)
Reusable utilities buried in entry point. Should be in utils.ts or args.ts.

#### LOW: parseFlags silently eats valueless flags (lines 36-44)
`meet-ai create-room myroom --color` treats `--color` as positional since no following value.
**Fix:** Error: "Flag --color requires a value"

---

### client.ts

#### HIGH: API key in WebSocket URL query parameter (line 143)
```typescript
const tokenParam = apiKey ? `?token=${apiKey}` : "";
```
Key appears in server access logs, browser history, proxy logs.
**Fix:** Use WebSocket subprotocol header or initial auth message after connection.

#### MEDIUM: download-attachment duplicates client.downloadAttachment() (lines 366-393 in index.ts vs 317-336 in client.ts)
CLI command manually implements fetch + write-to-disk identical to client method.
**Fix:** Enhance client.downloadAttachment() to optionally extract filename from headers.

#### MEDIUM: Missing .catch() on res.json() (lines 93, 128, 344)
Some error paths call res.json() without .catch(() => ({})) but others do.
**Fix:** Consistent .catch() on all error-path res.json() calls.

#### MEDIUM: No input sanitization on URL path parameters
Room IDs, sender names interpolated directly into URLs. No validation.
**Fix:** Validate IDs match `/^[a-zA-Z0-9_-]+$/` before use.

#### MEDIUM: 9 instances of `any` type
- client.ts line 108: `(err as any).error`
- client.ts line 283: `(err as any).error`
- client.ts line 299: `(err as any).error`
- index.ts line 156: `messages.map(async (msg: any) =>`
- index.ts line 210: `entry as any`
- index.ts line 217: `const onMessage = (msg: any) =>`
- index.ts line 375: `(err as any).error`
- inbox-router.ts line 9: `let messages: any[] = [];`
- inbox-router.ts line 18: `(m: any) => m.name`
**Fix:** Define proper types for API responses, messages, team config.

#### LOW: Inconsistent require() vs import() for node:fs (line 58)
cleanupOldAttachments uses `require("node:fs")` while rest uses `await import()`.
**Fix:** Use consistent import style.

#### LOW: Hardcoded /tmp/meet-ai-attachments in 3 locations
Constant `ATTACHMENTS_DIR` exists but not used consistently.
**Fix:** Export and import everywhere.

#### LOW: Inconsistent retry wrapping
sendMessage, sendLog, sendTeamInfo, sendTasks use withRetry(). createRoom, getMessages, deleteRoom etc do not.
**Fix:** Apply consistently or document why excluded.

#### LOW: `this` binding fragility in listen() (line 175)
`this.getMessages.bind(this)` inside object literal from factory function. Fragile if destructured.
**Fix:** Capture reference at closure level.

#### LOW: createClient returns anonymous object type (line 76)
No named interface. Hard to type in other files/tests.
**Fix:** Define and export `MeetAiClient` interface.

#### LOW: Message/AttachmentMeta types not exported (line 1)
Used in index.ts implicitly through `any`.
**Fix:** Export types.

---

### config.ts

#### MEDIUM: getConfigSource() duplicates getMeetAiConfig() logic (lines 89-107 vs 37-76)
Entire priority chain implemented twice.
**Fix:** Have getMeetAiConfig() return source alongside config.

#### LOW: resolve(".") is CWD-dependent (line 50)
Could surprise users running CLI from subdirectory.

#### LOW: isConfigured() and getConfigSource() exported but never used (line 81)
Dead code.
**Fix:** Use them or remove them.

---

### spawner.ts

#### LOW: Error message says `npm` instead of `bun` (line 45)
Should be `bun add -g @anthropic-ai/claude-code`.

---

### inbox-router.ts

#### MEDIUM: appendToInbox is not atomic (lines 7-13)
Read, parse, append, write. If two processes call concurrently, one write overwrites the other.
**Fix:** Use file locking or JSONL format.

#### LOW: Corrupted inbox file causes data loss (line 10)
JSON.parse fail resets messages to []. writeFileSync overwrites all previous.
**Fix:** Use JSONL format or backup before overwrite.

---

### Test Files

#### MEDIUM: Tests suppress console.error without restoring
`console.error = () => {};` in beforeEach but never restored in afterEach. Silences errors for later suites.
**Fix:** Store original, restore in afterEach.

#### MEDIUM: Tests don't restore globalThis.fetch
`_originalFetch` saved but never restored.
**Fix:** Add afterEach(() => { globalThis.fetch = _originalFetch; })

#### LOW: Dead code _originalFetch
Variable assigned but never used in create-room.test.ts and send-log.test.ts.

---

### package.json

#### LOW: Package exports expose CLI entry as library interface
`"exports": { ".": "./dist/index.js" }` - anyone importing `@meet-ai/cli` gets the CLI runner.
**Fix:** If client should be importable, add `"./client": "./dist/client.js"`.
