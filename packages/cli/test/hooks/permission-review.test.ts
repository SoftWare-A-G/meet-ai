import { describe, expect, it, beforeEach, afterEach } from 'bun:test'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { setMeetAiDirOverride, writeHomeConfig } from '@meet-ai/cli/lib/meetai-home'
import { withMockFetch } from '../helpers/mock-fetch'

const TEST_DIR = '/tmp/meet-ai-pr-test-teams'
const TEMP_MEET_AI_DIR = '/tmp/meet-ai-pr-test-home'

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

describe('processPermissionReview', () => {
  const mockFetch = withMockFetch()
  let stderrOutput: string
  let stdoutOutput: string
  const originalStderrWrite = process.stderr.write.bind(process.stderr)
  const originalStdoutWrite = process.stdout.write.bind(process.stdout)

  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true })
    rmSync(TEMP_MEET_AI_DIR, { recursive: true, force: true })
    setMeetAiDirOverride(TEMP_MEET_AI_DIR)
    writeHomeConfig({
      defaultEnv: 'default',
      envs: { default: { url: 'http://localhost:9999', key: 'mai_test123' } },
    })
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
    rmSync(TEMP_MEET_AI_DIR, { recursive: true, force: true })
    setMeetAiDirOverride(undefined)
    process.stderr.write = originalStderrWrite
    process.stdout.write = originalStdoutWrite
  })

  it('skips when stdin is not valid JSON', async () => {
    const { processPermissionReview } = await import('../../src/commands/hook/permission-review/usecase')
    await processPermissionReview('not json', TEST_DIR)
    expect(stderrOutput).toContain('ParseError: Invalid JSON')
    expect(stdoutOutput).toBe('')
  })

  it('skips when session_id is missing', async () => {
    const { processPermissionReview } = await import('../../src/commands/hook/permission-review/usecase')
    await processPermissionReview(makeInput({ session_id: '' }), TEST_DIR)
    expect(stderrOutput).toContain('ValidationError: session_id is required')
    expect(stdoutOutput).toBe('')
  })

  it('skips when tool_name is missing', async () => {
    const { processPermissionReview } = await import('../../src/commands/hook/permission-review/usecase')
    await processPermissionReview(makeInput({ tool_name: '' }), TEST_DIR)
    expect(stderrOutput).toContain('ValidationError: tool_name is required')
    expect(stdoutOutput).toBe('')
  })

  it('skips when no room found for session', async () => {
    const { processPermissionReview } = await import('../../src/commands/hook/permission-review/usecase')
    await processPermissionReview(makeInput(), TEST_DIR)
    expect(stderrOutput).toContain('RoomResolveError: No room found for session')
    expect(stdoutOutput).toBe('')
  })

  it('silently skips when no home config exists', async () => {
    const { processPermissionReview } = await import('../../src/commands/hook/permission-review/usecase')
    writeTeamFile('my-team', { session_id: 'sess-1', room_id: 'room-abc' })
    setMeetAiDirOverride('/tmp/nonexistent-meet-ai-dir-99')
    await processPermissionReview(makeInput(), TEST_DIR)
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
  })

  it('handles create review failure', async () => {
    const { processPermissionReview } = await import('../../src/commands/hook/permission-review/usecase')
    writeTeamFile('my-team', { session_id: 'sess-1', room_id: 'room-abc' })

    // Mock create review — server error (JSON, matching actual Hono error responses)
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    await processPermissionReview(makeInput(), TEST_DIR, { pollInterval: 10, pollTimeout: 500 })

    expect(stdoutOutput).toBe('')
    expect(stderrOutput).toContain('ReviewCreateError: HTTP 500')
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
    expect(stderrOutput).toContain('TimeoutError: Timed out waiting for decision')
  })

  it('never throws — always exits cleanly on fetch network error', async () => {
    const { processPermissionReview } = await import('../../src/commands/hook/permission-review/usecase')
    writeTeamFile('my-team', { session_id: 'sess-1', room_id: 'room-abc' })

    // Mock create review — network error
    mockFetch.mockRejectedValueOnce(new Error('Network failure'))

    await processPermissionReview(makeInput(), TEST_DIR, { pollInterval: 10, pollTimeout: 500 })

    expect(stdoutOutput).toBe('')
    expect(stderrOutput).toContain('ReviewCreateError: Error: Network failure')
  })
})
