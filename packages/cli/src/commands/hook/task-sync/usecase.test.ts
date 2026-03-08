import { describe, it, expect, mock, beforeEach } from 'bun:test'
import { TaskHookInput, TaskCreateHookInput, TaskUpdateHookInput } from './schema'

// Real captured payloads from Claude Code PostToolUse events
const TASK_CREATE_PAYLOAD = {
  session_id: '1c3c163e-54c4-4fc0-a994-67de0628b2fa',
  transcript_path: '/tmp/test/.claude/projects/test-project/abc123.jsonl',
  cwd: '/tmp/test/project',
  permission_mode: 'bypassPermissions',
  hook_event_name: 'PostToolUse',
  tool_name: 'TaskCreate' as const,
  tool_input: {
    subject: 'Third test task for hook validation',
    description: 'Another smoke test task to help validate the task-sync hook payload capture.',
  },
  tool_response: {
    task: {
      id: '3',
      subject: 'Third test task for hook validation',
    },
  },
  tool_use_id: 'toolu_01VGBKybim1p2Dj5wAer8Emw',
}

const TASK_UPDATE_PAYLOAD = {
  session_id: '1c3c163e-54c4-4fc0-a994-67de0628b2fa',
  transcript_path: '/tmp/test/.claude/projects/test-project/abc123.jsonl',
  cwd: '/tmp/test/project',
  permission_mode: 'bypassPermissions',
  hook_event_name: 'PostToolUse',
  tool_name: 'TaskUpdate' as const,
  tool_input: {
    taskId: '2',
    status: 'in_progress',
    owner: 'hook-debugger',
  },
  tool_response: {
    success: true,
    taskId: '2',
    updatedFields: ['owner', 'status'],
    statusChange: {
      from: 'pending',
      to: 'in_progress',
    },
  },
  tool_use_id: 'toolu_01P1odPBubvtBLEmUSx59v8J',
}

describe('TaskHookInput schema', () => {
  it('parses a real TaskCreate payload', () => {
    const result = TaskCreateHookInput.safeParse(TASK_CREATE_PAYLOAD)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.tool_response.task.id).toBe('3')
      expect(result.data.tool_input.subject).toBe('Third test task for hook validation')
    }
  })

  it('parses a real TaskUpdate payload', () => {
    const result = TaskUpdateHookInput.safeParse(TASK_UPDATE_PAYLOAD)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.tool_response.taskId).toBe('2')
      expect(result.data.tool_input.status).toBe('in_progress')
      expect(result.data.tool_input.owner).toBe('hook-debugger')
    }
  })

  it('discriminates correctly via TaskHookInput union', () => {
    const createResult = TaskHookInput.safeParse(TASK_CREATE_PAYLOAD)
    expect(createResult.success).toBe(true)
    if (createResult.success) {
      expect(createResult.data.tool_name).toBe('TaskCreate')
    }

    const updateResult = TaskHookInput.safeParse(TASK_UPDATE_PAYLOAD)
    expect(updateResult.success).toBe(true)
    if (updateResult.success) {
      expect(updateResult.data.tool_name).toBe('TaskUpdate')
    }
  })

  it('rejects payload with wrong tool_name', () => {
    const result = TaskHookInput.safeParse({
      ...TASK_CREATE_PAYLOAD,
      tool_name: 'Bash',
    })
    expect(result.success).toBe(false)
  })

  it('rejects TaskCreate without tool_response.task', () => {
    const result = TaskCreateHookInput.safeParse({
      ...TASK_CREATE_PAYLOAD,
      tool_response: { success: true },
    })
    expect(result.success).toBe(false)
  })

  it('rejects TaskUpdate without tool_response.taskId', () => {
    const result = TaskUpdateHookInput.safeParse({
      ...TASK_UPDATE_PAYLOAD,
      tool_response: { success: true },
    })
    expect(result.success).toBe(false)
  })
})

// Mock the hooks module for processTaskSync tests
const mockFindRoom = mock(() => Promise.resolve({ roomId: 'room-123', teamName: 'test-team' }))
const mockPost = mock(() => Promise.resolve({ ok: true }))
const mockCreateHookClient = mock(() => ({
  api: {
    rooms: {
      ':id': {
        tasks: {
          upsert: {
            $post: mockPost,
          },
        },
      },
    },
  },
}))

mock.module('@meet-ai/cli/lib/hooks', () => ({
  findRoom: mockFindRoom,
  createHookClient: mockCreateHookClient,
}))

// Import after mocking
const { processTaskSync } = await import('./usecase')

describe('processTaskSync', () => {
  beforeEach(() => {
    mockFindRoom.mockClear()
    mockPost.mockClear()
    mockCreateHookClient.mockClear()
    mockFindRoom.mockResolvedValue({ roomId: 'room-123', teamName: 'test-team' })
    mockPost.mockResolvedValue({ ok: true })
    process.env.MEET_AI_URL = 'https://test.example.com'
    process.env.MEET_AI_KEY = 'mai_testkey123'
  })

  it('sends upsert for TaskCreate with correct fields', async () => {
    const result = await processTaskSync(JSON.stringify(TASK_CREATE_PAYLOAD))

    expect(result).toBe('sent')
    expect(mockPost).toHaveBeenCalledTimes(1)

    const call = mockPost.mock.calls[0][0]
    expect(call.param.id).toBe('room-123')
    expect(call.json.source).toBe('claude')
    expect(call.json.source_id).toBe('3')
    expect(call.json.subject).toBe('Third test task for hook validation')
    expect(call.json.description).toBe('Another smoke test task to help validate the task-sync hook payload capture.')
    expect(call.json.status).toBe('pending')
  })

  it('sends upsert for TaskUpdate with correct fields', async () => {
    const result = await processTaskSync(JSON.stringify(TASK_UPDATE_PAYLOAD))

    expect(result).toBe('sent')
    expect(mockPost).toHaveBeenCalledTimes(1)

    const call = mockPost.mock.calls[0][0]
    expect(call.param.id).toBe('room-123')
    expect(call.json.source).toBe('claude')
    expect(call.json.source_id).toBe('2')
    expect(call.json.status).toBe('in_progress')
    expect(call.json.assignee).toBe('hook-debugger')
  })

  it('skips on invalid JSON', async () => {
    expect(await processTaskSync('not-json')).toBe('skip')
  })

  it('skips on wrong tool_name', async () => {
    const payload = { ...TASK_CREATE_PAYLOAD, tool_name: 'Bash' }
    expect(await processTaskSync(JSON.stringify(payload))).toBe('skip')
  })

  it('skips when room not found', async () => {
    mockFindRoom.mockResolvedValue(null)
    expect(await processTaskSync(JSON.stringify(TASK_CREATE_PAYLOAD))).toBe('skip')
  })

  it('skips when env vars missing', async () => {
    delete process.env.MEET_AI_URL
    expect(await processTaskSync(JSON.stringify(TASK_CREATE_PAYLOAD))).toBe('skip')
  })

  it('skips when API returns non-ok', async () => {
    mockPost.mockResolvedValue({ ok: false, status: 500, statusText: 'Internal Server Error' })
    expect(await processTaskSync(JSON.stringify(TASK_CREATE_PAYLOAD))).toBe('skip')
  })
})
