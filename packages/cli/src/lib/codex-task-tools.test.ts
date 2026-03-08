import { describe, expect, it, mock } from 'bun:test'
import { PassThrough } from 'node:stream'
import type { ChildProcessWithoutNullStreams, SpawnOptionsWithoutStdio } from 'node:child_process'
import type { DynamicToolCallResponse } from '@meet-ai/cli/generated/codex-app-server/v2/DynamicToolCallResponse'
import { CodexAppServerBridge } from './codex-app-server'
import {
  CreateTaskInput,
  UpdateTaskInput,
  ListTasksInput,
  GetTaskInput,
  TASK_TOOL_SPECS,
  TASK_TOOL_NAMES,
  makeToolResponse,
  makeToolError,
  createTaskToolCallHandler,
  type TaskObject,
  type TaskOperations,
} from './codex-task-tools'

function parseResponseData(response: DynamicToolCallResponse): any {
  const item = response.contentItems[0]
  if (item.type !== 'inputText') throw new Error('Expected inputText content item')
  return JSON.parse(item.text)
}

// --- Fixtures ---

const TASK_FIXTURE: TaskObject = {
  id: 'task-abc-123',
  subject: 'Implement auth module',
  description: 'Add JWT-based auth',
  status: 'pending',
  assignee: 'codex',
  owner: null,
  source: 'codex',
  source_id: null,
  updated_by: 'codex',
  updated_at: 1741477200000,
}

const TASK_FIXTURE_2: TaskObject = {
  id: 'task-def-456',
  subject: 'Write tests',
  status: 'in_progress',
  assignee: 'alice',
  owner: 'alice',
  source: 'meet_ai',
  source_id: null,
  updated_by: 'alice',
  updated_at: 1741477300000,
}

function createMockOps(overrides?: Partial<TaskOperations>): TaskOperations {
  return {
    createTask: mock(async () => TASK_FIXTURE),
    updateTask: mock(async () => ({ ...TASK_FIXTURE, status: 'completed' })),
    listTasks: mock(async () => [TASK_FIXTURE, TASK_FIXTURE_2]),
    getTask: mock(async () => TASK_FIXTURE),
    ...overrides,
  }
}

// --- Zod schema tests ---

describe('Zod input schemas', () => {
  describe('CreateTaskInput', () => {
    it('accepts valid input with all fields', () => {
      const result = CreateTaskInput.safeParse({
        subject: 'Build feature',
        description: 'Detailed description',
        assignee: 'codex',
      })
      expect(result.success).toBe(true)
    })

    it('accepts valid input with only required fields', () => {
      const result = CreateTaskInput.safeParse({ subject: 'Build feature' })
      expect(result.success).toBe(true)
    })

    it('rejects empty subject', () => {
      const result = CreateTaskInput.safeParse({ subject: '' })
      expect(result.success).toBe(false)
    })

    it('rejects missing subject', () => {
      const result = CreateTaskInput.safeParse({})
      expect(result.success).toBe(false)
    })
  })

  describe('UpdateTaskInput', () => {
    it('accepts valid input with status change', () => {
      const result = UpdateTaskInput.safeParse({
        task_id: 'task-1',
        status: 'in_progress',
      })
      expect(result.success).toBe(true)
    })

    it('rejects empty patch (only task_id, no fields to update)', () => {
      const result = UpdateTaskInput.safeParse({ task_id: 'task-1' })
      expect(result.success).toBe(false)
    })

    it('rejects missing task_id', () => {
      const result = UpdateTaskInput.safeParse({ status: 'completed' })
      expect(result.success).toBe(false)
    })

    it('rejects invalid status', () => {
      const result = UpdateTaskInput.safeParse({
        task_id: 'task-1',
        status: 'invalid',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('ListTasksInput', () => {
    it('accepts empty object (no filters)', () => {
      const result = ListTasksInput.safeParse({})
      expect(result.success).toBe(true)
    })

    it('accepts status filter', () => {
      const result = ListTasksInput.safeParse({ status: 'pending' })
      expect(result.success).toBe(true)
    })

    it('accepts assignee filter', () => {
      const result = ListTasksInput.safeParse({ assignee: 'codex' })
      expect(result.success).toBe(true)
    })

    it('rejects invalid status', () => {
      const result = ListTasksInput.safeParse({ status: 'invalid' })
      expect(result.success).toBe(false)
    })
  })

  describe('GetTaskInput', () => {
    it('accepts valid task_id', () => {
      const result = GetTaskInput.safeParse({ task_id: 'task-1' })
      expect(result.success).toBe(true)
    })

    it('rejects empty task_id', () => {
      const result = GetTaskInput.safeParse({ task_id: '' })
      expect(result.success).toBe(false)
    })

    it('rejects missing task_id', () => {
      const result = GetTaskInput.safeParse({})
      expect(result.success).toBe(false)
    })
  })
})

// --- Tool spec tests ---

describe('TASK_TOOL_SPECS', () => {
  it('defines exactly 4 tools', () => {
    expect(TASK_TOOL_SPECS).toHaveLength(4)
  })

  it('has matching names in TASK_TOOL_NAMES set', () => {
    for (const spec of TASK_TOOL_SPECS) {
      expect(TASK_TOOL_NAMES.has(spec.name)).toBe(true)
    }
    expect(TASK_TOOL_NAMES.size).toBe(4)
  })

  it('each spec has name, description, and inputSchema', () => {
    for (const spec of TASK_TOOL_SPECS) {
      expect(typeof spec.name).toBe('string')
      expect(typeof spec.description).toBe('string')
      expect(spec.inputSchema).toBeDefined()
    }
  })
})

// --- Response helper tests ---

describe('makeToolResponse', () => {
  it('wraps data as inputText content item', () => {
    const response = makeToolResponse({ id: 'task-1' })
    expect(response).toEqual({
      contentItems: [{ type: 'inputText', text: '{"id":"task-1"}' }],
      success: true,
    })
  })

  it('supports explicit success=false', () => {
    const response = makeToolResponse({ error: 'oops' }, false)
    expect(response.success).toBe(false)
  })
})

describe('makeToolError', () => {
  it('returns structured error with success=false', () => {
    const response = makeToolError('Task not found')
    expect(response).toEqual({
      contentItems: [{ type: 'inputText', text: '{"error":"Task not found"}' }],
      success: false,
    })
  })
})

// --- createTaskToolCallHandler tests ---

describe('createTaskToolCallHandler', () => {
  it('create_task calls createTask and returns canonical task', async () => {
    const ops = createMockOps()
    const handler = createTaskToolCallHandler(ops)

    const result = await handler('create_task', {
      subject: 'New task',
      description: 'Do the thing',
      assignee: 'codex',
    })

    expect(result.success).toBe(true)
    const data = parseResponseData(result)
    expect(data.id).toBe('task-abc-123')
    expect(data.subject).toBe('Implement auth module')
    expect(ops.createTask).toHaveBeenCalledWith({
      subject: 'New task',
      description: 'Do the thing',
      assignee: 'codex',
    })
  })

  it('create_task returns error when API call fails', async () => {
    const ops = createMockOps({ createTask: mock(async () => null) })
    const handler = createTaskToolCallHandler(ops)

    const result = await handler('create_task', { subject: 'Test' })

    expect(result.success).toBe(false)
    const data = parseResponseData(result)
    expect(data.error).toBe('Failed to create task')
  })

  it('create_task rejects missing subject with validation error', async () => {
    const ops = createMockOps()
    const handler = createTaskToolCallHandler(ops)

    const result = await handler('create_task', {})

    expect(result.success).toBe(false)
    expect(ops.createTask).not.toHaveBeenCalled()
  })

  it('update_task calls updateTask with patch and returns updated task', async () => {
    const ops = createMockOps()
    const handler = createTaskToolCallHandler(ops)

    const result = await handler('update_task', {
      task_id: 'task-abc-123',
      status: 'completed',
    })

    expect(result.success).toBe(true)
    const data = parseResponseData(result)
    expect(data.status).toBe('completed')
    expect(ops.updateTask).toHaveBeenCalledWith('task-abc-123', {
      status: 'completed',
    })
  })

  it('update_task rejects empty patch', async () => {
    const ops = createMockOps()
    const handler = createTaskToolCallHandler(ops)

    const result = await handler('update_task', { task_id: 'task-1' })

    expect(result.success).toBe(false)
    const data = parseResponseData(result)
    expect(data.error).toContain('At least one field')
    expect(ops.updateTask).not.toHaveBeenCalled()
  })

  it('update_task returns error when task not found', async () => {
    const ops = createMockOps({ updateTask: mock(async () => null) })
    const handler = createTaskToolCallHandler(ops)

    const result = await handler('update_task', {
      task_id: 'nonexistent',
      status: 'completed',
    })

    expect(result.success).toBe(false)
    const data = parseResponseData(result)
    expect(data.error).toBe('Task not found')
  })

  it('list_tasks returns array of tasks', async () => {
    const ops = createMockOps()
    const handler = createTaskToolCallHandler(ops)

    const result = await handler('list_tasks', {})

    expect(result.success).toBe(true)
    const data = parseResponseData(result)
    expect(data.tasks).toHaveLength(2)
    expect(data.tasks[0].id).toBe('task-abc-123')
    expect(data.tasks[1].id).toBe('task-def-456')
  })

  it('list_tasks passes filters to operations', async () => {
    const ops = createMockOps()
    const handler = createTaskToolCallHandler(ops)

    await handler('list_tasks', { status: 'pending', assignee: 'codex' })

    expect(ops.listTasks).toHaveBeenCalledWith({
      status: 'pending',
      assignee: 'codex',
    })
  })

  it('get_task returns single task', async () => {
    const ops = createMockOps()
    const handler = createTaskToolCallHandler(ops)

    const result = await handler('get_task', { task_id: 'task-abc-123' })

    expect(result.success).toBe(true)
    const data = parseResponseData(result)
    expect(data.id).toBe('task-abc-123')
    expect(data.subject).toBe('Implement auth module')
    expect(ops.getTask).toHaveBeenCalledWith('task-abc-123')
  })

  it('get_task returns error when task not found', async () => {
    const ops = createMockOps({ getTask: mock(async () => null) })
    const handler = createTaskToolCallHandler(ops)

    const result = await handler('get_task', { task_id: 'nonexistent' })

    expect(result.success).toBe(false)
    const data = parseResponseData(result)
    expect(data.error).toBe('Task not found')
  })

  it('get_task rejects missing task_id', async () => {
    const ops = createMockOps()
    const handler = createTaskToolCallHandler(ops)

    const result = await handler('get_task', {})

    expect(result.success).toBe(false)
    expect(ops.getTask).not.toHaveBeenCalled()
  })

  it('returns error for unknown tool name', async () => {
    const ops = createMockOps()
    const handler = createTaskToolCallHandler(ops)

    const result = await handler('unknown_tool', {})

    expect(result.success).toBe(false)
    const data = parseResponseData(result)
    expect(data.error).toContain('Unknown task tool')
  })
})

// --- Bridge integration tests ---

type RecordedMessage = {
  method?: string
  id?: string | number
  params?: any
  result?: any
  error?: any
}

function createFakeAppServer() {
  const stdin = new PassThrough()
  const stdout = new PassThrough()
  const stderr = new PassThrough()
  const messages: RecordedMessage[] = []

  let buffered = ''
  stdin.on('data', (chunk) => {
    buffered += chunk.toString()
    let newlineIndex = buffered.indexOf('\n')
    while (newlineIndex >= 0) {
      const line = buffered.slice(0, newlineIndex).trim()
      buffered = buffered.slice(newlineIndex + 1)
      newlineIndex = buffered.indexOf('\n')
      if (!line) continue

      const msg = JSON.parse(line) as RecordedMessage
      messages.push(msg)

      switch (msg.method) {
        case 'initialize':
          stdout.write(`${JSON.stringify({ id: msg.id, result: { userAgent: 'codex-test' } })}\n`)
          break
        case 'thread/start':
          stdout.write(`${JSON.stringify({ id: msg.id, result: { thread: { id: 'thread-1', turns: [] } } })}\n`)
          break
        case 'turn/start':
          stdout.write(`${JSON.stringify({ id: msg.id, result: { turn: { id: 'turn-1' } } })}\n`)
          break
      }
    }
  })

  const child = {
    stdin,
    stdout,
    stderr,
    kill: mock(() => true),
    on: mock((_event: string, _handler: (...args: any[]) => void) => child),
  } as unknown as ChildProcessWithoutNullStreams

  const spawnFn = (
    _command: string,
    _args: string[],
    _spawnOptions: SpawnOptionsWithoutStdio,
  ) => child

  return { child, spawnFn, messages, stdout }
}

function emitServerRequest(
  child: ChildProcessWithoutNullStreams,
  request: Record<string, unknown>,
): void {
  child.stdout.push(`${JSON.stringify(request)}\n`)
}

describe('Bridge dynamic tools integration', () => {
  it('passes dynamicTools to thread/start params', async () => {
    const fake = createFakeAppServer()
    const bridge = new CodexAppServerBridge({
      spawnFn: fake.spawnFn,
      dynamicTools: TASK_TOOL_SPECS,
    })

    await bridge.injectPrompt('hello')

    const threadStart = fake.messages.find(m => m.method === 'thread/start')
    expect(threadStart).toBeDefined()
    expect(threadStart!.params.dynamicTools).toEqual(TASK_TOOL_SPECS)
  })

  it('omits dynamicTools from thread/start when empty', async () => {
    const fake = createFakeAppServer()
    const bridge = new CodexAppServerBridge({
      spawnFn: fake.spawnFn,
    })

    await bridge.injectPrompt('hello')

    const threadStart = fake.messages.find(m => m.method === 'thread/start')
    expect(threadStart).toBeDefined()
    expect(threadStart!.params.dynamicTools).toBeUndefined()
  })

  it('dispatches item/tool/call to toolCallHandler and writes response', async () => {
    const fake = createFakeAppServer()
    const handler = mock(async () => makeToolResponse({ id: 'task-1', subject: 'Test' }))
    const bridge = new CodexAppServerBridge({
      spawnFn: fake.spawnFn,
      dynamicTools: TASK_TOOL_SPECS,
      toolCallHandler: handler,
    })

    await bridge.injectPrompt('hello')

    // Simulate server sending a tool call request
    emitServerRequest(fake.child, {
      method: 'item/tool/call',
      id: 'call-42',
      params: {
        threadId: 'thread-1',
        turnId: 'turn-1',
        callId: 'call-42',
        tool: 'create_task',
        arguments: { subject: 'New task' },
      },
    })

    await new Promise(resolve => setTimeout(resolve, 10))

    expect(handler).toHaveBeenCalledWith('create_task', { subject: 'New task' })

    // Find the response written back (message with id 'call-42' and result)
    const response = fake.messages.find(m => m.id === 'call-42' && m.result)
    expect(response).toBeDefined()
    expect(response!.result.success).toBe(true)
    const data = JSON.parse(response!.result.contentItems[0].text)
    expect(data.id).toBe('task-1')
  })

  it('returns error response when no toolCallHandler is registered', async () => {
    const fake = createFakeAppServer()
    const bridge = new CodexAppServerBridge({
      spawnFn: fake.spawnFn,
    })

    await bridge.injectPrompt('hello')

    emitServerRequest(fake.child, {
      method: 'item/tool/call',
      id: 'call-99',
      params: {
        threadId: 'thread-1',
        turnId: 'turn-1',
        callId: 'call-99',
        tool: 'create_task',
        arguments: { subject: 'Test' },
      },
    })

    await new Promise(resolve => setTimeout(resolve, 10))

    const response = fake.messages.find(m => m.id === 'call-99' && m.result)
    expect(response).toBeDefined()
    expect(response!.result.success).toBe(false)
    const data = JSON.parse(response!.result.contentItems[0].text)
    expect(data.error).toContain('No handler registered')
  })

  it('returns error response when toolCallHandler throws', async () => {
    const fake = createFakeAppServer()
    const handler = mock(async () => {
      throw new Error('API connection failed')
    })
    const bridge = new CodexAppServerBridge({
      spawnFn: fake.spawnFn,
      toolCallHandler: handler,
    })

    await bridge.injectPrompt('hello')

    emitServerRequest(fake.child, {
      method: 'item/tool/call',
      id: 'call-err',
      params: {
        threadId: 'thread-1',
        turnId: 'turn-1',
        callId: 'call-err',
        tool: 'create_task',
        arguments: { subject: 'Test' },
      },
    })

    await new Promise(resolve => setTimeout(resolve, 10))

    const response = fake.messages.find(m => m.id === 'call-err' && m.result)
    expect(response).toBeDefined()
    expect(response!.result.success).toBe(false)
    const data = JSON.parse(response!.result.contentItems[0].text)
    expect(data.error).toContain('API connection failed')
  })
})
