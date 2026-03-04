import { describe, expect, it, mock, beforeEach, afterEach } from 'bun:test'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'

const TEST_DIR = '/tmp/meet-ai-pr-test-teams'
const MOCK_URL = 'http://localhost:9999'
const MOCK_KEY = 'mai_test123'

function writeTeamFile(teamName: string, data: { session_id: string; room_id: string }) {
  const dir = `${TEST_DIR}/${teamName}`
  mkdirSync(dir, { recursive: true })
  writeFileSync(`${dir}/meet-ai.json`, JSON.stringify(data))
}

function makeInput(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    session_id: 'sess-1',
    hook_event_name: 'PermissionRequest',
    tool_name: 'Bash',
    tool_input: {
      command: 'ls -la',
      description: 'List files',
    },
    ...overrides,
  })
}

const originalFetch = globalThis.fetch
const originalEnv = { ...process.env }

describe('processPermissionReview', () => {
  let mockFetch: ReturnType<typeof mock>
  let stderrOutput: string
  let stdoutOutput: string
  const originalStderrWrite = process.stderr.write.bind(process.stderr)
  const originalStdoutWrite = process.stdout.write.bind(process.stdout)

  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true })
    mockFetch = mock()
    globalThis.fetch = mockFetch as unknown as typeof fetch
    process.env.MEET_AI_URL = MOCK_URL
    process.env.MEET_AI_KEY = MOCK_KEY
    stderrOutput = ''
    stdoutOutput = ''
    process.stderr.write = ((chunk: string) => {
      stderrOutput += chunk
      return true
    }) as typeof process.stderr.write
    process.stdout.write = ((chunk: string) => {
      stdoutOutput += chunk
      return true
    }) as typeof process.stdout.write
  })

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
    globalThis.fetch = originalFetch
    process.env = { ...originalEnv }
    process.stderr.write = originalStderrWrite
    process.stdout.write = originalStdoutWrite
  })

  it('skips when stdin is not valid JSON', async () => {
    const { processPermissionReview } = await import('../../src/commands/hook/permission-review/usecase')
    await processPermissionReview('not json', TEST_DIR)
    expect(stderrOutput).toContain('failed to parse stdin')
    expect(stdoutOutput).toBe('')
  })

  it('skips when session_id is missing', async () => {
    const { processPermissionReview } = await import('../../src/commands/hook/permission-review/usecase')
    await processPermissionReview(makeInput({ session_id: '' }), TEST_DIR)
    expect(stderrOutput).toContain('missing session_id or tool_name')
    expect(stdoutOutput).toBe('')
  })

  it('skips when tool_name is missing', async () => {
    const { processPermissionReview } = await import('../../src/commands/hook/permission-review/usecase')
    await processPermissionReview(makeInput({ tool_name: '' }), TEST_DIR)
    expect(stderrOutput).toContain('missing session_id or tool_name')
    expect(stdoutOutput).toBe('')
  })

  it('skips when no room found for session', async () => {
    const { processPermissionReview } = await import('../../src/commands/hook/permission-review/usecase')
    await processPermissionReview(makeInput(), TEST_DIR)
    expect(stderrOutput).toContain('no room found for session')
    expect(stdoutOutput).toBe('')
  })

  it('skips when env vars are missing', async () => {
    const { processPermissionReview } = await import('../../src/commands/hook/permission-review/usecase')
    writeTeamFile('my-team', { session_id: 'sess-1', room_id: 'room-abc' })
    delete process.env.MEET_AI_URL
    delete process.env.MEET_AI_KEY
    await processPermissionReview(makeInput(), TEST_DIR)
    expect(stderrOutput).toContain('MEET_AI_URL or MEET_AI_KEY not set')
    expect(stdoutOutput).toBe('')
  })

  it('creates permission review and outputs allow on approval', async () => {
    const { processPermissionReview } = await import('../../src/commands/hook/permission-review/usecase')
    writeTeamFile('my-team', { session_id: 'sess-1', room_id: 'room-abc' })

    // Mock create review
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'pr-1', message_id: 'msg-1' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    // Mock poll — approved immediately
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ status: 'approved', decided_by: 'user1' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )

    await processPermissionReview(makeInput(), TEST_DIR, { pollInterval: 10, pollTimeout: 500 })

    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(stdoutOutput).not.toBe('')
    const output = JSON.parse(stdoutOutput)
    expect(output.hookSpecificOutput.hookEventName).toBe('PermissionRequest')
    expect(output.hookSpecificOutput.decision.behavior).toBe('allow')
  })

  it('outputs deny on denied decision', async () => {
    const { processPermissionReview } = await import('../../src/commands/hook/permission-review/usecase')
    writeTeamFile('my-team', { session_id: 'sess-1', room_id: 'room-abc' })

    // Mock create review
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'pr-2' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    // Mock poll — denied
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ status: 'denied', decided_by: 'user1' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )

    await processPermissionReview(makeInput(), TEST_DIR, { pollInterval: 10, pollTimeout: 500 })

    const output = JSON.parse(stdoutOutput)
    expect(output.hookSpecificOutput.decision.behavior).toBe('deny')
    expect(output.hookSpecificOutput.decision.message).toContain('Permission denied')
  })

  it('handles pending then approved poll', async () => {
    const { processPermissionReview } = await import('../../src/commands/hook/permission-review/usecase')
    writeTeamFile('my-team', { session_id: 'sess-1', room_id: 'room-abc' })

    // Mock create review
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'pr-3' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    // First poll — still pending
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 'pending' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    // Second poll — approved
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ status: 'approved' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )

    await processPermissionReview(makeInput(), TEST_DIR, { pollInterval: 10, pollTimeout: 500 })

    expect(mockFetch).toHaveBeenCalledTimes(3)
    const output = JSON.parse(stdoutOutput)
    expect(output.hookSpecificOutput.decision.behavior).toBe('allow')
  })

  it('handles expired status — no stdout output', async () => {
    const { processPermissionReview } = await import('../../src/commands/hook/permission-review/usecase')
    writeTeamFile('my-team', { session_id: 'sess-1', room_id: 'room-abc' })

    // Mock create review
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'pr-4' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    // Poll returns expired
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 'expired' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    await processPermissionReview(makeInput(), TEST_DIR, { pollInterval: 10, pollTimeout: 500 })

    expect(stdoutOutput).toBe('')
    expect(stderrOutput).toContain('decision received: expired')
  })

  it('handles create review failure', async () => {
    const { processPermissionReview } = await import('../../src/commands/hook/permission-review/usecase')
    writeTeamFile('my-team', { session_id: 'sess-1', room_id: 'room-abc' })

    // Mock create review — server error
    mockFetch.mockResolvedValueOnce(
      new Response('Internal Server Error', { status: 500 })
    )

    await processPermissionReview(makeInput(), TEST_DIR, { pollInterval: 10, pollTimeout: 500 })

    expect(stdoutOutput).toBe('')
    expect(stderrOutput).toContain('create failed: 500')
  })

  it('handles poll timeout — sends timeout message and expires review', async () => {
    const { processPermissionReview } = await import('../../src/commands/hook/permission-review/usecase')
    writeTeamFile('my-team', { session_id: 'sess-1', room_id: 'room-abc' })

    // Mock create review
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'pr-5' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    // All polls return pending — will timeout
    mockFetch.mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ status: 'pending' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    )

    // Use very short timeout to avoid slow test
    await processPermissionReview(makeInput(), TEST_DIR, { pollInterval: 10, pollTimeout: 50 })

    expect(stdoutOutput).toBe('')
    expect(stderrOutput).toContain('timed out waiting for decision')
  })

  it('never throws — always exits cleanly on fetch network error', async () => {
    const { processPermissionReview } = await import('../../src/commands/hook/permission-review/usecase')
    writeTeamFile('my-team', { session_id: 'sess-1', room_id: 'room-abc' })

    // Mock create review — network error
    mockFetch.mockRejectedValueOnce(new Error('Network failure'))

    await processPermissionReview(makeInput(), TEST_DIR, { pollInterval: 10, pollTimeout: 500 })

    expect(stdoutOutput).toBe('')
    expect(stderrOutput).toContain('create error')
  })
})
