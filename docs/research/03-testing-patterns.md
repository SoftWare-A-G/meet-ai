# CLI Testing Patterns Research

> Agent: cli-testing-researcher
> Date: 2025-02-21
> Task: Deep research into testing patterns for Node.js/Bun CLI tools

---

## 1. Framework: Stick with bun:test

### Why bun:test over vitest for our CLI:
- Zero config, zero deps - stays aligned with our zero-dep philosophy
- Fast startup (sub-second for ~30 tests)
- Jest-compatible API (describe, test, expect, mock, spyOn)
- Native TypeScript support
- `mock.module()` for ESM/CJS module mocking

### Known caveats:
- No test isolation by default - mocks leak between tests. Must manually `mockReset()`/`mockRestore()`
- `Bun.spawn` stdout pipe bug (#24690) - use `child_process.spawn` for integration tests
- Coverage only tracks imported files - untested files don't appear in report

---

## 2. Unit Testing Patterns

> ### DECISION (Owner: @isnifer, 2026-02-21)
>
> **New architecture:** citty + zod with per-command directories. Tests live co-located with usecases.
> - **Usecase tests first** (`commands/<name>/usecase.test.ts`) — test business logic + zod validation
> - **Integration tests second** — pass args through CLI interface via subprocess
> - **Zod is the validation wall** — test that invalid inputs are rejected by the schema
> - No more hand-rolled `parseFlags` — citty handles arg parsing, zod validates the parsed result

### Testing usecases (the primary testing target)
```typescript
// src/commands/create-room/usecase.test.ts
import { describe, test, expect, spyOn, beforeEach, afterAll } from "bun:test";
import { createRoom } from "./usecase";
import { CreateRoomInput } from "./schema"; // zod schema

describe("createRoom usecase", () => {
  const fetchSpy = spyOn(globalThis, "fetch");
  beforeEach(() => fetchSpy.mockReset());
  afterAll(() => fetchSpy.mockRestore());

  test("creates room and returns id + name", async () => {
    // The API returns a room object on successful creation
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ id: "room-abc", name: "my-room" }), { status: 201 })
    );
    const result = await createRoom({ name: "my-room" });
    expect(result).toEqual({ id: "room-abc", name: "my-room" });
  });

  test("rejects empty room name via zod validation", () => {
    const result = CreateRoomInput.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });
});
```

### Testing zod schemas in isolation
```typescript
// Zod schemas are the source of truth — test edge cases thoroughly
test("SendMessageInput rejects content over max length", () => {
  const result = SendMessageInput.safeParse({
    roomId: "room-1",
    sender: "bot",
    content: "x".repeat(100_001),
  });
  expect(result.success).toBe(false);
});

test("SendMessageInput accepts valid input with optional color", () => {
  const result = SendMessageInput.safeParse({
    roomId: "room-1",
    sender: "bot",
    content: "hello",
    color: "#ff0000",
  });
  expect(result.success).toBe(true);
});
```

### Mocking fetch (use spyOn, not direct assignment)
```typescript
const fetchSpy = spyOn(globalThis, "fetch");
beforeEach(() => fetchSpy.mockReset());
afterAll(() => fetchSpy.mockRestore());

// In each test:
fetchSpy.mockResolvedValue(
  new Response(JSON.stringify({ id: "msg-1" }), { status: 200 })
);
```

**Why spyOn over direct assignment:** `mockRestore()` automatically restores original. No need for `_originalFetch` variable.

### Mocking WebSocket (FakeWebSocket class)
```typescript
class FakeWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  readyState = FakeWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  url: string;
  sent: string[] = [];

  constructor(url: string) {
    this.url = url;
    queueMicrotask(() => this.onopen?.());
  }
  send(data: string) { this.sent.push(data); }
  close(code?: number) {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.({ code: code ?? 1000 });
  }
  // Test helpers
  _receive(data: object) { this.onmessage?.({ data: JSON.stringify(data) }); }
  _disconnect(code: number) { this.onclose?.({ code }); }
}
```

### Mocking process.exit

> **NOTE:** With citty + zod, most validation errors are caught by zod before reaching process.exit. Test zod schemas directly instead. Reserve process.exit mocking for integration-level tests only.

```typescript
const exitSpy = spyOn(process, "exit").mockImplementation(() => {
  throw new Error("process.exit called");
});

test("missing room name calls process.exit(1)", () => {
  expect(() => handleCreateRoom([])).toThrow("process.exit called");
  expect(exitSpy).toHaveBeenCalledWith(1);
});
```

### Mocking console.log/error
```typescript
const logSpy = spyOn(console, "log").mockImplementation(() => {});
const errorSpy = spyOn(console, "error").mockImplementation(() => {});
afterAll(() => { logSpy.mockRestore(); errorSpy.mockRestore(); });
```

---

## 3. Integration Testing

### CLI execution helper
```typescript
// test/helpers/run-cli.ts
import { spawn } from "node:child_process";

export function runCli(args: string[], env?: Record<string, string>): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
}> {
  return new Promise((resolve) => {
    const proc = spawn("bun", [CLI_PATH, ...args], {
      env: { ...process.env, ...env },
    });
    let stdout = "", stderr = "";
    proc.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    proc.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    proc.on("close", (code) => {
      resolve({ exitCode: code ?? 1, stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
}
```

### Mock HTTP server (Bun.serve)
```typescript
let server: ReturnType<typeof Bun.serve>;

beforeAll(() => {
  server = Bun.serve({
    port: 0, // random available port
    fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === "/api/rooms" && req.method === "POST") {
        return Response.json({ id: "room-abc", name: "test" }, { status: 201 });
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    },
  });
});
afterAll(() => server.stop(true));
```

### WebSocket integration test
```typescript
let server: ReturnType<typeof Bun.serve>;

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    fetch(req, server) {
      if (req.headers.get("upgrade") === "websocket") {
        return server.upgrade(req) ? undefined : new Response("Upgrade failed", { status: 400 });
      }
      return new Response("Not found", { status: 404 });
    },
    websocket: {
      open(ws) { ws.send(JSON.stringify({ id: "0", sender: "server", content: "welcome" })); },
      message(ws, msg) { ws.send(msg); },
    },
  });
});
```

---

## 4. Test Organization

### Recommended structure:

> **UPDATED** to match new per-command directory architecture with citty + zod.

```
src/
  commands/
    create-room/
      usecase.ts              # Business logic + zod schema
      usecase.test.ts         # Unit tests for usecase (co-located!)
      command.ts              # citty defineCommand binding
    send-message/
      usecase.ts
      usecase.test.ts
      command.ts
    listen/
      usecase.ts
      usecase.test.ts
      command.ts
    poll/
      ...
  client.ts                   # HTTP + WebSocket client
  config.ts                   # Config resolution

test/
  helpers/
    run-cli.ts                # subprocess helper for integration tests
    fake-websocket.ts         # WebSocket mock class
    mock-server.ts            # Bun.serve test server factory
  client/
    client.test.ts            # client.ts unit tests (fetch mocking)
    retry.test.ts             # withRetry logic
  integration/
    cli-commands.test.ts      # subprocess tests: exit codes, help text, zod errors
    cli-errors.test.ts        # error handling integration
  config.test.ts              # config priority chain tests
  inbox-router.test.ts        # inbox routing tests (already exists)
```

**Key change:** Usecase tests live next to their usecase files (`commands/<name>/usecase.test.ts`). Integration tests and shared helpers stay in `test/`.

### Test grouping (describe/it)
```typescript
describe("createClient().sendLog", () => {
  test("POSTs to /api/rooms/{id}/logs", async () => { ... });
  test("includes color when provided", async () => { ... });

  describe("when server returns 500", () => {
    test("retries up to 3 times", async () => { ... });
    test("throws after all retries exhausted", async () => { ... });
  });
});
```

---

## 5. Human-Readable Test Patterns

### Test description as documentation:
- Bad: `"calls fetch with POST method"`
- Good: `"sending a message delivers it with agent sender type"`
- Best: `"sendMessage: when color is provided, includes it in the request body"`

### Comment pattern: Explain WHY, not WHAT
```typescript
// BAD
// Mock fetch
globalThis.fetch = mock(async () => new Response("{}"));

// GOOD
// The client wraps fetch with retry logic, so we control each call
// to verify retry behavior on transient failures
fetchSpy
  .mockRejectedValueOnce(new TypeError("fetch failed"))  // 1st: network error -> triggers retry
  .mockResolvedValueOnce(new Response(JSON.stringify({ id: "msg-1" }))); // 2nd: success
```

### Given/When/Then in code:
```typescript
test("checkIdleAgents: stale inbox reports agent as newly idle", () => {
  // GIVEN an inbox directory with a researcher's file
  const inboxDir = join(tmpDir, "inboxes");
  mkdirSync(inboxDir, { recursive: true });
  writeFileSync(join(inboxDir, "researcher.json"), "[]");

  // WHEN we check for idle agents 6 minutes later
  const result = checkIdleAgents(inboxDir, members, "team-lead", notified, sixMinLater);

  // THEN researcher is reported as idle
  expect(result).toEqual(["researcher"]);
});
```

---

## 6. Coverage & CI

### Enable in bunfig.toml:
```toml
[test]
coverage = true
coverageSkipTestFiles = true
coverageReporter = ["text", "lcov"]
```

---

## 7. Coverage Targets for New Architecture

> **UPDATED** for citty + zod per-command architecture. Old coverage gaps are moot since the entire CLI is being restructured.

### Priority 1: Usecase tests (one per command)
Each `commands/<name>/usecase.test.ts` should cover:
- Happy path with valid zod input
- Zod validation rejection (invalid/missing fields)
- API error responses (4xx, 5xx)
- Edge cases specific to the command

| Command | Usecase Test | What to cover |
|---|---|---|
| `create-room` | `usecase.test.ts` | Valid name, empty name, API error |
| `send-message` | `usecase.test.ts` | Valid msg, missing fields, color optional, `\\n` unescape |
| `send-log` | `usecase.test.ts` | Valid log, optional color/messageId |
| `poll` | `usecase.test.ts` | Filters (after, exclude, sender-type), empty results |
| `listen` | `usecase.test.ts` | WS connection, reconnection, dedup, filtering |
| `send-team-info` | `usecase.test.ts` | Valid JSON payload, invalid payload |
| `send-tasks` | `usecase.test.ts` | Valid tasks payload |
| `delete-room` | `usecase.test.ts` | Valid roomId, API error |
| `download-attachment` | `usecase.test.ts` | Single `<attachmentId>` download, zod validation (empty/invalid), API error propagation |
| `generate-key` | `usecase.test.ts` | Key generation response |

### Priority 2: Client tests
- `withRetry` (already covered, keep)
- `sendMessage`, `getMessages`, `listen`, `deleteRoom` (new)

### Priority 3: Shared module tests
- `config.ts` - priority chain, defaults
- `inbox-router.ts` - already covered, keep

### Priority 4: Integration tests
- All commands via subprocess: correct exit codes, help text, zod error output
- Standard-schema error output for agent self-correction
