import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test'
import { rmSync } from 'node:fs'
import { setMeetAiDirOverride, writeHomeConfig } from '@meet-ai/cli/lib/meetai-home'
import { TaskHookInputSchema, TaskCreateHookInputSchema, TaskUpdateHookInputSchema } from '@meet-ai/domain'

const TEMP_MEET_AI_DIR = '/tmp/meet-ai-task-sync-test-home'

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
    const result = TaskCreateHookInputSchema.safeParse(TASK_CREATE_PAYLOAD)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.tool_response.task.id).toBe('3')
      expect(result.data.tool_input.subject).toBe('Third test task for hook validation')
    }
  })

  it('parses a real TaskUpdate payload', () => {
    const result = TaskUpdateHookInputSchema.safeParse(TASK_UPDATE_PAYLOAD)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.tool_response.taskId).toBe('2')
      expect(result.data.tool_input.status).toBe('in_progress')
      expect(result.data.tool_input.owner).toBe('hook-debugger')
    }
  })

  it('discriminates correctly via TaskHookInput union', () => {
    const createResult = TaskHookInputSchema.safeParse(TASK_CREATE_PAYLOAD)
    expect(createResult.success).toBe(true)
    if (createResult.success) {
      expect(createResult.data.tool_name).toBe('TaskCreate')
    }

    const updateResult = TaskHookInputSchema.safeParse(TASK_UPDATE_PAYLOAD)
    expect(updateResult.success).toBe(true)
    if (updateResult.success) {
      expect(updateResult.data.tool_name).toBe('TaskUpdate')
    }
  })

  it('rejects payload with wrong tool_name', () => {
    const result = TaskHookInputSchema.safeParse({
      ...TASK_CREATE_PAYLOAD,
      tool_name: 'Bash',
    })
    expect(result.success).toBe(false)
  })

  it('rejects TaskCreate without tool_response.task', () => {
    const result = TaskCreateHookInputSchema.safeParse({
      ...TASK_CREATE_PAYLOAD,
      tool_response: { success: true },
    })
    expect(result.success).toBe(false)
  })

  it('rejects TaskUpdate without tool_response.taskId', () => {
    const result = TaskUpdateHookInputSchema.safeParse({
      ...TASK_UPDATE_PAYLOAD,
      tool_response: { success: true },
    })
    expect(result.success).toBe(false)
  })
})

// Mock findRoomId so SessionRoomResolver returns the room we want
const mockFindRoomId = mock(() => Promise.resolve('room-123'))
mock.module('@meet-ai/cli/lib/hooks/find-room', () => ({
  findRoom: mock(() => Promise.resolve({ roomId: 'room-123', teamName: 'test-team' })),
  findRoomId: mockFindRoomId,
}))

// Mock createHookClient to return a fake client with the upsert endpoint
const mockPost = mock(() => Promise.resolve({ ok: true }))
mock.module('@meet-ai/cli/lib/hooks/client', () => ({
  createHookClient: () => ({
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
  }),
}))

// Import after mocking
const { processTaskSync } = await import('./usecase')

describe('processTaskSync', () => {
  beforeEach(() => {
    mockFindRoomId.mockClear()
    mockPost.mockClear()
    mockFindRoomId.mockResolvedValue('room-123')
    mockPost.mockResolvedValue({ ok: true })
    rmSync(TEMP_MEET_AI_DIR, { recursive: true, force: true })
    setMeetAiDirOverride(TEMP_MEET_AI_DIR)
    writeHomeConfig({
      defaultEnv: 'default',
      envs: { default: { url: 'https://test.example.com', key: 'mai_testkey123' } },
    })
  })

  afterEach(() => {
    setMeetAiDirOverride(undefined)
    rmSync(TEMP_MEET_AI_DIR, { recursive: true, force: true })
  })

  it('sends upsert for TaskCreate with correct fields', async () => {
    const result = await processTaskSync(JSON.stringify(TASK_CREATE_PAYLOAD))

    expect(result).toBe('sent')
    expect(mockPost).toHaveBeenCalledTimes(1)
    expect(mockPost).toHaveBeenCalledWith({
      param: { id: 'room-123' },
      json: {
        source: 'claude',
        source_id: '3',
        subject: 'Third test task for hook validation',
        description: 'Another smoke test task to help validate the task-sync hook payload capture.',
        status: 'pending',
        updated_by: 'claude',
      },
    })
  })

  it('sends upsert for TaskUpdate with correct fields', async () => {
    const result = await processTaskSync(JSON.stringify(TASK_UPDATE_PAYLOAD))

    expect(result).toBe('sent')
    expect(mockPost).toHaveBeenCalledTimes(1)
    expect(mockPost).toHaveBeenCalledWith({
      param: { id: 'room-123' },
      json: {
        source: 'claude',
        source_id: '2',
        status: 'in_progress',
        assignee: 'hook-debugger',
        updated_by: 'claude',
      },
    })
  })

  it('skips on invalid JSON', async () => {
    expect(await processTaskSync('not-json')).toBe('skip')
  })

  it('skips on wrong tool_name', async () => {
    const payload = { ...TASK_CREATE_PAYLOAD, tool_name: 'Bash' }
    expect(await processTaskSync(JSON.stringify(payload))).toBe('skip')
  })

  it('skips when room not found', async () => {
    mockFindRoomId.mockResolvedValue(null)
    expect(await processTaskSync(JSON.stringify(TASK_CREATE_PAYLOAD))).toBe('skip')
  })

  it('skips when no home config exists', async () => {
    setMeetAiDirOverride('/tmp/nonexistent-meet-ai-dir-99')
    expect(await processTaskSync(JSON.stringify(TASK_CREATE_PAYLOAD))).toBe('skip')
  })

  it('skips when API returns non-ok', async () => {
    mockPost.mockResolvedValue({ ok: false, status: 500, statusText: 'Internal Server Error' })
    expect(await processTaskSync(JSON.stringify(TASK_CREATE_PAYLOAD))).toBe('skip')
  })
})
