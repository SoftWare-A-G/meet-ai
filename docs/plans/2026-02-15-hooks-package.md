# Hooks Package + Zod Validation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract the bash PostToolUse hook into a typed Node.js package with tests, add Zod validation to all worker routes, and use `hono/client` for type-safe API calls.

**Architecture:** New `packages/hooks` package reads hook JSON from stdin, finds the active room by scanning team files, builds a tool summary, and sends it to the meet-ai API via `hono/client`. The worker routes get `@hono/zod-validator` middleware so `hono/client` infers full request/response types. A symlink from `.claude/hooks/` points to the built entry point.

**Tech Stack:** Node.js, Hono (`hono/client`), Zod 4, `@hono/zod-validator`, vitest, bun

---

## Task 1: Add Zod schemas to worker route — rooms (POST /api/rooms)

**Files:**
- Create: `packages/worker/src/schemas/rooms.ts`
- Modify: `packages/worker/src/routes/rooms.ts`

**Step 1: Install deps in worker package**

```bash
cd packages/worker && bun add -E zod@4.3.6 @hono/zod-validator@0.7.6
```

**Step 2: Create schemas file**

Create `packages/worker/src/schemas/rooms.ts`:

```ts
import { z } from 'zod/v4'

export const createRoomSchema = z.object({
  name: z.string().min(1),
})

export const sendMessageSchema = z.object({
  sender: z.string().min(1),
  content: z.string().min(1),
  sender_type: z.enum(['agent', 'human']).optional(),
  color: z.string().optional(),
  attachment_ids: z.array(z.string()).optional(),
})

export const sendLogSchema = z.object({
  sender: z.string().min(1),
  content: z.string().min(1),
  color: z.string().optional(),
  message_id: z.string().optional(),
})

export const teamInfoMemberSchema = z.object({
  name: z.string(),
  color: z.string(),
  role: z.string(),
  model: z.string(),
  status: z.enum(['active', 'inactive']),
  joinedAt: z.number(),
})

export const teamInfoSchema = z.object({
  team_name: z.string(),
  members: z.array(teamInfoMemberSchema),
})
```

**Step 3: Wire Zod validators into rooms route**

Modify `packages/worker/src/routes/rooms.ts`:

- Add imports at top:
  ```ts
  import { zValidator } from '@hono/zod-validator'
  import { createRoomSchema, sendMessageSchema, sendLogSchema, teamInfoSchema } from '../schemas/rooms'
  ```
- Replace `POST /` handler: add `zValidator('json', createRoomSchema)` middleware, use `c.req.valid('json')` instead of `c.req.json<>()`
- Replace `POST /:id/messages` handler: add `zValidator('json', sendMessageSchema)`, use `c.req.valid('json')`
- Replace `POST /:id/logs` handler: add `zValidator('json', sendLogSchema)`, use `c.req.valid('json')`
- Replace `POST /:id/team-info` handler: add `zValidator('json', teamInfoSchema)`, use `c.req.valid('json')`
- `POST /:id/tasks` stays as generic `c.req.json()` (free-form JSON)

For each route, the pattern is the same. Example for `POST /`:

Before:
```ts
.post('/', requireAuth, async c => {
  const body = await c.req.json<{ name?: string }>()
  if (!body.name) {
    return c.json({ error: 'name is required' }, 400)
  }
```

After:
```ts
.post('/', requireAuth, zValidator('json', createRoomSchema), async c => {
  const body = c.req.valid('json')
```

The manual `if (!body.name)` check is replaced by Zod validation. Same pattern for all routes.

**Step 4: Run existing tests to verify nothing breaks**

```bash
cd packages/worker && bun run test
```

Expected: All 25 tests pass. Zod validation is stricter (rejects empty strings), so some edge-case tests may need adjustment — fix any that fail.

**Step 5: Run typecheck**

```bash
cd packages/worker && bun run typecheck
```

Expected: PASS

**Step 6: Commit**

```bash
git add packages/worker/src/schemas/rooms.ts packages/worker/src/routes/rooms.ts packages/worker/package.json
git commit -m "feat(worker): add Zod validation to rooms routes"
```

---

## Task 2: Add Zod schemas to worker route — uploads (PATCH /api/attachments/:id)

**Files:**
- Create: `packages/worker/src/schemas/uploads.ts`
- Modify: `packages/worker/src/routes/uploads.ts`

**Step 1: Create uploads schema**

Create `packages/worker/src/schemas/uploads.ts`:

```ts
import { z } from 'zod/v4'

export const linkAttachmentSchema = z.object({
  message_id: z.string().min(1),
})
```

**Step 2: Wire into uploads route**

Modify `packages/worker/src/routes/uploads.ts` — add `zValidator('json', linkAttachmentSchema)` to the `PATCH /attachments/:id` handler, use `c.req.valid('json')`.

**Step 3: Run tests + typecheck**

```bash
cd packages/worker && bun run test && bun run typecheck
```

Expected: PASS

**Step 4: Commit**

```bash
git add packages/worker/src/schemas/uploads.ts packages/worker/src/routes/uploads.ts
git commit -m "feat(worker): add Zod validation to uploads route"
```

---

## Task 3: Export AppType from worker

**Files:**
- Modify: `packages/worker/src/index.ts`

**Step 1: Add type export**

Add at the bottom of `packages/worker/src/index.ts`:

```ts
export type AppType = typeof app
```

This is what `hono/client` consumes from the hooks package.

**Step 2: Typecheck**

```bash
cd packages/worker && bun run typecheck
```

Expected: PASS

**Step 3: Commit**

```bash
git add packages/worker/src/index.ts
git commit -m "feat(worker): export AppType for hono/client consumers"
```

---

## Task 4: Scaffold `packages/hooks` package

**Files:**
- Create: `packages/hooks/package.json`
- Create: `packages/hooks/tsconfig.json`
- Create: `packages/hooks/src/types.ts`

**Step 1: Create package.json**

```json
{
  "name": "@meet-ai/hooks",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "hono": "4.11.8"
  },
  "devDependencies": {
    "@types/node": "catalog:",
    "typescript": "catalog:",
    "vitest": "3.2.4"
  }
}
```

Note: `hono` is needed for `hono/client`. We do NOT need `zod` here — types flow through `AppType`.

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["src", "test"]
}
```

**Step 3: Create types file**

Create `packages/hooks/src/types.ts`:

```ts
export type HookInput = {
  session_id: string
  tool_name: string
  tool_input: Record<string, unknown>
}

export type TeamSessionFile = {
  session_id: string
  room_id: string
}
```

**Step 4: Install deps**

```bash
cd packages/hooks && bun install
```

**Step 5: Commit**

```bash
git add packages/hooks/package.json packages/hooks/tsconfig.json packages/hooks/src/types.ts
git commit -m "feat(hooks): scaffold hooks package"
```

---

## Task 5: Implement `summarize.ts` with tests (TDD)

**Files:**
- Create: `packages/hooks/src/summarize.ts`
- Create: `packages/hooks/test/summarize.test.ts`

**Step 1: Write the failing tests**

Create `packages/hooks/test/summarize.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { summarize } from '../src/summarize'

describe('summarize', () => {
  it('summarizes Edit with basename', () => {
    expect(summarize('Edit', { file_path: '/foo/bar/baz.ts' })).toBe('Edit: baz.ts')
  })

  it('summarizes Bash with truncated command', () => {
    const cmd = 'a'.repeat(80)
    const result = summarize('Bash', { command: cmd })
    expect(result).toBe(`Bash: ${'a'.repeat(60)}`)
  })

  it('summarizes Grep with pattern and glob', () => {
    expect(summarize('Grep', { pattern: 'foo', glob: '*.ts' })).toBe('Grep: "foo" in *.ts')
  })

  it('summarizes Grep with pattern and path', () => {
    expect(summarize('Grep', { pattern: 'foo', path: 'src/' })).toBe('Grep: "foo" in src/')
  })

  it('summarizes Read with basename', () => {
    expect(summarize('Read', { file_path: '/a/b/c.json' })).toBe('Read: c.json')
  })

  it('summarizes Write with basename', () => {
    expect(summarize('Write', { file_path: '/x/y.md' })).toBe('Write: y.md')
  })

  it('summarizes Glob with pattern', () => {
    expect(summarize('Glob', { pattern: '**/*.ts' })).toBe('Glob: **/*.ts')
  })

  it('summarizes Task with truncated description', () => {
    const desc = 'b'.repeat(80)
    expect(summarize('Task', { description: desc })).toBe(`Task: ${'b'.repeat(60)}`)
  })

  it('summarizes WebFetch with url', () => {
    expect(summarize('WebFetch', { url: 'https://example.com' })).toBe('WebFetch: https://example.com')
  })

  it('summarizes WebSearch with query', () => {
    expect(summarize('WebSearch', { query: 'hono zod' })).toBe('WebSearch: hono zod')
  })

  it('returns tool name for unknown tools', () => {
    expect(summarize('AskUserQuestion', {})).toBe('AskUserQuestion')
  })
})
```

**Step 2: Run tests — should fail (module not found)**

```bash
cd packages/hooks && bunx vitest run test/summarize.test.ts
```

Expected: FAIL — `Cannot find module '../src/summarize'`

**Step 3: Implement summarize**

Create `packages/hooks/src/summarize.ts`:

```ts
import { basename } from 'node:path'

export function summarize(toolName: string, toolInput: Record<string, unknown>): string {
  const str = (key: string) => (typeof toolInput[key] === 'string' ? (toolInput[key] as string) : '')
  const truncate = (s: string, n: number) => s.slice(0, n)
  const file = (key: string) => basename(str(key)) || '?'

  switch (toolName) {
    case 'Edit': return `Edit: ${file('file_path')}`
    case 'Read': return `Read: ${file('file_path')}`
    case 'Write': return `Write: ${file('file_path')}`
    case 'Bash': return `Bash: ${truncate(str('command'), 60)}`
    case 'Grep': return `Grep: "${str('pattern')}" in ${str('glob') || str('path')}`
    case 'Glob': return `Glob: ${str('pattern')}`
    case 'Task': return `Task: ${truncate(str('description'), 60)}`
    case 'WebFetch': return `WebFetch: ${str('url')}`
    case 'WebSearch': return `WebSearch: ${str('query')}`
    default: return toolName
  }
}
```

**Step 4: Run tests — should pass**

```bash
cd packages/hooks && bunx vitest run test/summarize.test.ts
```

Expected: PASS (all 11 tests)

**Step 5: Commit**

```bash
git add packages/hooks/src/summarize.ts packages/hooks/test/summarize.test.ts
git commit -m "feat(hooks): add summarize module with tests"
```

---

## Task 6: Implement `find-room.ts` with tests (TDD)

**Files:**
- Create: `packages/hooks/src/find-room.ts`
- Create: `packages/hooks/test/find-room.test.ts`

**Step 1: Write the failing tests**

Create `packages/hooks/test/find-room.test.ts`:

```ts
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { findRoomId } from '../src/find-room'

const TEST_DIR = '/tmp/meet-ai-hook-test-teams'

function writeTeamFile(teamName: string, data: { session_id: string; room_id: string }) {
  const dir = `${TEST_DIR}/${teamName}`
  mkdirSync(dir, { recursive: true })
  writeFileSync(`${dir}/meet-ai.json`, JSON.stringify(data))
}

describe('findRoomId', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true })
  })

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
  })

  it('returns room_id when session matches', () => {
    writeTeamFile('my-team', { session_id: 'sess-1', room_id: 'room-abc' })
    expect(findRoomId('sess-1', TEST_DIR)).toBe('room-abc')
  })

  it('returns null when no session matches', () => {
    writeTeamFile('my-team', { session_id: 'sess-other', room_id: 'room-abc' })
    expect(findRoomId('sess-1', TEST_DIR)).toBeNull()
  })

  it('returns null when teams dir does not exist', () => {
    expect(findRoomId('sess-1', '/tmp/nonexistent-dir-12345')).toBeNull()
  })

  it('scans multiple team dirs', () => {
    writeTeamFile('team-a', { session_id: 'sess-a', room_id: 'room-a' })
    writeTeamFile('team-b', { session_id: 'sess-b', room_id: 'room-b' })
    expect(findRoomId('sess-b', TEST_DIR)).toBe('room-b')
  })

  it('skips malformed JSON files', () => {
    const dir = `${TEST_DIR}/broken`
    mkdirSync(dir, { recursive: true })
    writeFileSync(`${dir}/meet-ai.json`, 'not json')
    expect(findRoomId('sess-1', TEST_DIR)).toBeNull()
  })
})
```

**Step 2: Run tests — should fail**

```bash
cd packages/hooks && bunx vitest run test/find-room.test.ts
```

Expected: FAIL

**Step 3: Implement find-room**

Create `packages/hooks/src/find-room.ts`:

```ts
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { TeamSessionFile } from './types'

export function findRoomId(sessionId: string, teamsDir?: string): string | null {
  const dir = teamsDir ?? `${process.env.HOME}/.claude/teams`
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return null
  }

  for (const entry of entries) {
    const filePath = join(dir, entry, 'meet-ai.json')
    try {
      const raw = readFileSync(filePath, 'utf-8')
      const data: TeamSessionFile = JSON.parse(raw)
      if (data.session_id === sessionId) {
        return data.room_id || null
      }
    } catch {
      continue
    }
  }

  return null
}
```

**Step 4: Run tests — should pass**

```bash
cd packages/hooks && bunx vitest run test/find-room.test.ts
```

Expected: PASS (all 5 tests)

**Step 5: Commit**

```bash
git add packages/hooks/src/find-room.ts packages/hooks/test/find-room.test.ts
git commit -m "feat(hooks): add find-room module with tests"
```

---

## Task 7: Implement `client.ts` — hono/client wrapper with tests (TDD)

**Files:**
- Create: `packages/hooks/src/client.ts`
- Create: `packages/hooks/test/client.test.ts`

**Step 1: Write the failing tests**

Create `packages/hooks/test/client.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createHookClient, sendParentMessage, sendLogEntry } from '../src/client'

const MOCK_URL = 'http://localhost:9999'
const MOCK_KEY = 'mai_test123'

describe('client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('sendParentMessage', () => {
    it('posts to /api/rooms/:id/messages and returns message id', async () => {
      const mockResponse = { id: 'msg-123', room_id: 'room-1', sender: 'hook', content: 'Agent activity', sender_type: 'agent', color: '#6b7280', type: 'message', seq: 1, created_at: '2026-01-01T00:00:00Z', attachment_count: 0 }
      vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(mockResponse), { status: 201, headers: { 'Content-Type': 'application/json' } }))

      const client = createHookClient(MOCK_URL, MOCK_KEY)
      const id = await sendParentMessage(client, 'room-1')

      expect(id).toBe('msg-123')
      expect(fetch).toHaveBeenCalledOnce()
      const [url, init] = vi.mocked(fetch).mock.calls[0]
      expect(url.toString()).toContain('/api/rooms/room-1/messages')
      expect(init?.method).toBe('POST')
    })

    it('returns null on HTTP error', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response('{"error":"not found"}', { status: 404 }))

      const client = createHookClient(MOCK_URL, MOCK_KEY)
      const id = await sendParentMessage(client, 'room-1')

      expect(id).toBeNull()
    })
  })

  describe('sendLogEntry', () => {
    it('posts to /api/rooms/:id/logs with message_id', async () => {
      const mockResponse = { id: 'log-1', room_id: 'room-1', message_id: 'msg-1', sender: 'hook', content: 'Edit: foo.ts', color: '#6b7280', type: 'log', created_at: '2026-01-01T00:00:00Z' }
      vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(mockResponse), { status: 201, headers: { 'Content-Type': 'application/json' } }))

      const client = createHookClient(MOCK_URL, MOCK_KEY)
      await sendLogEntry(client, 'room-1', 'Edit: foo.ts', 'msg-1')

      expect(fetch).toHaveBeenCalledOnce()
      const [url] = vi.mocked(fetch).mock.calls[0]
      expect(url.toString()).toContain('/api/rooms/room-1/logs')
    })

    it('does not throw on HTTP error', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response('{"error":"fail"}', { status: 500 }))

      const client = createHookClient(MOCK_URL, MOCK_KEY)
      await expect(sendLogEntry(client, 'room-1', 'test', 'msg-1')).resolves.not.toThrow()
    })
  })
})
```

**Step 2: Run tests — should fail**

```bash
cd packages/hooks && bunx vitest run test/client.test.ts
```

Expected: FAIL

**Step 3: Implement client**

Create `packages/hooks/src/client.ts`:

```ts
import { hc } from 'hono/client'
import type { AppType } from '@meet-ai/worker'

const HOOK_COLOR = '#6b7280'
const HOOK_SENDER = 'hook'

export function createHookClient(url: string, key: string) {
  return hc<AppType>(url, {
    headers: { Authorization: `Bearer ${key}` },
  })
}

export type HookClient = ReturnType<typeof createHookClient>

export async function sendParentMessage(client: HookClient, roomId: string): Promise<string | null> {
  try {
    const res = await client.api.rooms[':id'].messages.$post({
      param: { id: roomId },
      json: { sender: HOOK_SENDER, content: 'Agent activity', sender_type: 'agent' as const, color: HOOK_COLOR },
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.id
  } catch {
    return null
  }
}

export async function sendLogEntry(client: HookClient, roomId: string, summary: string, messageId?: string): Promise<void> {
  try {
    await client.api.rooms[':id'].logs.$post({
      param: { id: roomId },
      json: { sender: HOOK_SENDER, content: summary, color: HOOK_COLOR, ...(messageId && { message_id: messageId }) },
    })
  } catch {
    // Never throw — hook must not block the agent
  }
}
```

**Step 4: Run tests — should pass**

```bash
cd packages/hooks && bunx vitest run test/client.test.ts
```

Expected: PASS (all 4 tests)

Note: `hono/client` generates fetch calls under the hood, so mocking `globalThis.fetch` is sufficient. If `hc` constructs URLs differently than expected, adjust the URL assertions to match.

**Step 5: Commit**

```bash
git add packages/hooks/src/client.ts packages/hooks/test/client.test.ts
git commit -m "feat(hooks): add hono/client wrapper with tests"
```

---

## Task 8: Implement `index.ts` — main entry point with integration tests (TDD)

**Files:**
- Create: `packages/hooks/src/index.ts`
- Create: `packages/hooks/test/index.test.ts`

**Step 1: Write the failing integration test**

Create `packages/hooks/test/index.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { processHookInput } from '../src/index'

const TEST_DIR = '/tmp/meet-ai-hook-test-teams'
const MSGID_DIR = '/tmp'

function writeTeamFile(data: { session_id: string; room_id: string }) {
  const dir = `${TEST_DIR}/test-team`
  mkdirSync(dir, { recursive: true })
  writeFileSync(`${dir}/meet-ai.json`, JSON.stringify(data))
}

describe('processHookInput', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true })
    vi.stubGlobal('fetch', vi.fn())
    vi.stubEnv('MEET_AI_URL', 'http://localhost:9999')
    vi.stubEnv('MEET_AI_KEY', 'mai_test123')
  })

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    // Clean up msgid files
    try { rmSync(`${MSGID_DIR}/meet-ai-hook-sess-1.msgid`) } catch {}
  })

  it('skips when no session_id', async () => {
    const result = await processHookInput('{}', TEST_DIR)
    expect(result).toBe('skip')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('skips when tool is SendMessage', async () => {
    const input = JSON.stringify({ session_id: 'sess-1', tool_name: 'SendMessage', tool_input: {} })
    const result = await processHookInput(input, TEST_DIR)
    expect(result).toBe('skip')
  })

  it('skips Bash commands starting with meet-ai', async () => {
    const input = JSON.stringify({ session_id: 'sess-1', tool_name: 'Bash', tool_input: { command: 'meet-ai send-message room test' } })
    const result = await processHookInput(input, TEST_DIR)
    expect(result).toBe('skip')
  })

  it('skips Bash commands starting with cd', async () => {
    const input = JSON.stringify({ session_id: 'sess-1', tool_name: 'Bash', tool_input: { command: 'cd /foo/bar' } })
    const result = await processHookInput(input, TEST_DIR)
    expect(result).toBe('skip')
  })

  it('skips when no room found for session', async () => {
    writeTeamFile({ session_id: 'other', room_id: 'room-1' })
    const input = JSON.stringify({ session_id: 'sess-1', tool_name: 'Read', tool_input: { file_path: '/a/b.ts' } })
    const result = await processHookInput(input, TEST_DIR)
    expect(result).toBe('skip')
  })

  it('skips when no team files exist', async () => {
    const input = JSON.stringify({ session_id: 'sess-1', tool_name: 'Read', tool_input: { file_path: '/a/b.ts' } })
    const result = await processHookInput(input, '/tmp/nonexistent-dir-99999')
    expect(result).toBe('skip')
  })

  it('creates parent message on first call, then sends log', async () => {
    writeTeamFile({ session_id: 'sess-1', room_id: 'room-1' })

    // First fetch = sendParentMessage (201), second = sendLogEntry (201)
    const parentResponse = { id: 'msg-parent', room_id: 'room-1', sender: 'hook', content: 'Agent activity', sender_type: 'agent', color: '#6b7280', type: 'message', seq: 1, created_at: '2026-01-01', attachment_count: 0 }
    const logResponse = { id: 'log-1', room_id: 'room-1', message_id: 'msg-parent', sender: 'hook', content: 'Read: b.ts', color: '#6b7280', type: 'log', created_at: '2026-01-01' }

    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify(parentResponse), { status: 201, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify(logResponse), { status: 201, headers: { 'Content-Type': 'application/json' } }))

    const input = JSON.stringify({ session_id: 'sess-1', tool_name: 'Read', tool_input: { file_path: '/a/b.ts' } })
    const result = await processHookInput(input, TEST_DIR)

    expect(result).toBe('sent')
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('skips when MEET_AI_URL is not set', async () => {
    vi.stubEnv('MEET_AI_URL', '')
    writeTeamFile({ session_id: 'sess-1', room_id: 'room-1' })
    const input = JSON.stringify({ session_id: 'sess-1', tool_name: 'Read', tool_input: { file_path: '/a/b.ts' } })
    const result = await processHookInput(input, TEST_DIR)
    expect(result).toBe('skip')
  })
})
```

**Step 2: Run tests — should fail**

```bash
cd packages/hooks && bunx vitest run test/index.test.ts
```

Expected: FAIL

**Step 3: Implement index.ts**

Create `packages/hooks/src/index.ts`:

```ts
#!/usr/bin/env node
import { readFileSync, writeFileSync, statSync, rmSync } from 'node:fs'
import { findRoomId } from './find-room'
import { summarize } from './summarize'
import { createHookClient, sendParentMessage, sendLogEntry } from './client'
import type { HookInput } from './types'

const PARENT_MSG_TTL_SEC = 120

function getOrCreateParentId(sessionId: string): string | null {
  const path = `/tmp/meet-ai-hook-${sessionId}.msgid`
  try {
    const mtime = statSync(path).mtimeMs
    if (Date.now() - mtime > PARENT_MSG_TTL_SEC * 1000) {
      rmSync(path, { force: true })
      return null
    }
    return readFileSync(path, 'utf-8').trim() || null
  } catch {
    return null
  }
}

function saveParentId(sessionId: string, msgId: string) {
  writeFileSync(`/tmp/meet-ai-hook-${sessionId}.msgid`, msgId)
}

export async function processHookInput(rawInput: string, teamsDir?: string): Promise<'sent' | 'skip'> {
  let input: HookInput
  try {
    input = JSON.parse(rawInput)
  } catch {
    return 'skip'
  }

  const { session_id: sessionId, tool_name: toolName, tool_input: toolInput = {} } = input
  if (!sessionId || !toolName) return 'skip'

  // Skip SendMessage — internal agent communication
  if (toolName === 'SendMessage') return 'skip'

  // Skip Bash cd and meet-ai commands (avoid recursion)
  if (toolName === 'Bash') {
    const cmd = typeof toolInput.command === 'string' ? toolInput.command : ''
    if (cmd.startsWith('cd ') || cmd.startsWith('meet-ai ')) return 'skip'
  }

  // Find room
  const roomId = findRoomId(sessionId, teamsDir)
  if (!roomId) return 'skip'

  // Need env vars
  const url = process.env.MEET_AI_URL
  const key = process.env.MEET_AI_KEY
  if (!url || !key) return 'skip'

  const client = createHookClient(url, key)
  const summary = summarize(toolName, toolInput as Record<string, unknown>)

  // Get or create parent message
  let parentId = getOrCreateParentId(sessionId)
  if (!parentId) {
    parentId = await sendParentMessage(client, roomId)
    if (parentId) saveParentId(sessionId, parentId)
  }

  // Send log entry (fire-and-forget style, but we await for testing)
  await sendLogEntry(client, roomId, summary, parentId ?? undefined)

  return 'sent'
}

// Main: read stdin and run
async function main() {
  let input = ''
  for await (const chunk of process.stdin) {
    input += chunk
  }
  await processHookInput(input)
  process.exit(0)
}

// Only run main when executed directly (not imported by tests)
const isMain = process.argv[1] && (
  process.argv[1].endsWith('/hooks/src/index.ts') ||
  process.argv[1].endsWith('/hooks/dist/index.js')
)
if (isMain) {
  main().catch(() => process.exit(0))
}
```

**Step 4: Run tests — should pass**

```bash
cd packages/hooks && bunx vitest run
```

Expected: ALL tests pass across all 3 test files

**Step 5: Commit**

```bash
git add packages/hooks/src/index.ts packages/hooks/test/index.test.ts
git commit -m "feat(hooks): add main entry point with integration tests"
```

---

## Task 9: Replace bash hook with symlink + update settings

**Files:**
- Delete: `.claude/hooks/log-tool-use.sh`
- Create symlink: `.claude/hooks/log-tool-use` → runs the Node.js hook
- Modify: `.claude/settings.json`

**Step 1: Create a wrapper script that runs the hook via bun**

We can't symlink directly to a `.ts` file as a hook — Claude Code runs hooks as shell commands. Create `.claude/hooks/log-tool-use` (no extension):

```bash
#!/usr/bin/env bash
# Thin wrapper — runs the Node.js hook via bun
exec bun run "$(dirname "$0")/../../packages/hooks/src/index.ts"
```

This is a 2-line trampoline that delegates everything to the Node.js code.

**Step 2: Make executable, remove old script**

```bash
chmod +x .claude/hooks/log-tool-use
rm .claude/hooks/log-tool-use.sh
```

**Step 3: Update .claude/settings.json**

Change the hook command from `.claude/hooks/log-tool-use.sh` to `.claude/hooks/log-tool-use`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/log-tool-use",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

Note: `.claude/settings.json` is gitignored, so just update it locally.

**Step 4: Test manually**

Verify the hook runs by piping test JSON:

```bash
echo '{"session_id":"test","tool_name":"Read","tool_input":{"file_path":"/tmp/test.ts"}}' | .claude/hooks/log-tool-use
```

Expected: exits 0 silently (no team session to find, so it skips — but no crash).

**Step 5: Commit**

```bash
git add .claude/hooks/log-tool-use
git rm .claude/hooks/log-tool-use.sh
git commit -m "feat(hooks): replace bash hook with Node.js via bun wrapper"
```

---

## Task 10: Final typecheck + full test run

**Step 1: Run all tests**

```bash
cd packages/hooks && bunx vitest run
```

Expected: All tests pass

**Step 2: Run worker tests (ensure Zod didn't break anything)**

```bash
cd packages/worker && bun run test
```

Expected: All 25 tests pass

**Step 3: Run full monorepo typecheck**

```bash
bun run typecheck
```

Expected: PASS across all packages

**Step 4: Commit if any fixes were needed, then done**
