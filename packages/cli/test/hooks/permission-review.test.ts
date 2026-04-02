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
    expect(stderrOutput).toContain('bad input: Invalid JSON')
    expect(stdoutOutput).toBe('')
  })

  it('skips when session_id is missing', async () => {
    const { processPermissionReview } = await import('../../src/commands/hook/permission-review/usecase')
    await processPermissionReview(makeInput({ session_id: '' }), TEST_DIR)
    expect(stderrOutput).toContain('validation failed on "session_id": session_id is required')
    expect(stdoutOutput).toBe('')
  })

  it('skips when tool_name is missing', async () => {
    const { processPermissionReview } = await import('../../src/commands/hook/permission-review/usecase')
    await processPermissionReview(makeInput({ tool_name: '' }), TEST_DIR)
    expect(stderrOutput).toContain('validation failed on "tool_name": tool_name is required')
    expect(stdoutOutput).toBe('')
  })

  it('skips when no room found for session', async () => {
    const { processPermissionReview } = await import('../../src/commands/hook/permission-review/usecase')
    await processPermissionReview(makeInput(), TEST_DIR)
    expect(stderrOutput).toContain('room not found: No room found for session')
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
        JSON.stringify({ id: 'pr-1', message_id: 'msg-1', status: 'approved', feedback: null, decided_by: 'user1', decided_at: '2026-03-31T00:00:00Z' }),
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
      new Response(JSON.stringify({ id: 'pr-2', message_id: 'msg-2' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    // Mock poll — denied
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ id: 'pr-2', message_id: 'msg-2', status: 'denied', feedback: null, decided_by: 'user1', decided_at: '2026-03-31T00:00:00Z' }),
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
      new Response(JSON.stringify({ id: 'pr-3', message_id: 'msg-3' }), {
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
        JSON.stringify({ id: 'pr-3', message_id: 'msg-3', status: 'approved', feedback: null, decided_by: 'user1', decided_at: '2026-03-31T00:00:00Z' }),
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
      new Response(JSON.stringify({ id: 'pr-4', message_id: 'msg-4' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    // Poll returns expired
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ id: 'pr-4', message_id: 'msg-4', status: 'expired', feedback: null, decided_by: null, decided_at: null }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
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
    expect(stderrOutput).toContain('failed to create review:')
  })

  it('handles poll timeout — sends timeout message and expires review', async () => {
    const { processPermissionReview } = await import('../../src/commands/hook/permission-review/usecase')
    writeTeamFile('my-team', { session_id: 'sess-1', room_id: 'room-abc' })

    // Mock create review
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'pr-5', message_id: 'msg-5' }), {
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
    expect(stderrOutput).toContain('timed out: Timed out waiting for decision')
  })

  it('never throws — always exits cleanly on fetch network error', async () => {
    const { processPermissionReview } = await import('../../src/commands/hook/permission-review/usecase')
    writeTeamFile('my-team', { session_id: 'sess-1', room_id: 'room-abc' })

    // Mock create review — network error
    mockFetch.mockRejectedValueOnce(new Error('Network failure'))

    await processPermissionReview(makeInput(), TEST_DIR, { pollInterval: 10, pollTimeout: 500 })

    expect(stdoutOutput).toBe('')
    expect(stderrOutput).toContain('failed to create review: Error: Network failure')
  })

  it('returns ReviewPollError when all polls throw (network failure)', async () => {
    const { processPermissionReview } = await import('../../src/commands/hook/permission-review/usecase')
    writeTeamFile('my-team', { session_id: 'sess-1', room_id: 'room-abc' })

    // Create review succeeds
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'pr-poll-fail', message_id: 'msg-poll-fail' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    // All subsequent fetches throw (network failure) — polls never succeed
    mockFetch.mockImplementation(() => Promise.reject(new Error('Network failure')))

    await processPermissionReview(makeInput(), TEST_DIR, { pollInterval: 10, pollTimeout: 50 })

    expect(stderrOutput).toContain('poll failed:')
    expect(stderrOutput).not.toContain('timed out:')
    expect(stdoutOutput).toBe('')
  })

  it('timeout cleanup — verifies create, poll, expire, and timeout message calls', async () => {
    const { processPermissionReview } = await import('../../src/commands/hook/permission-review/usecase')
    writeTeamFile('my-team', { session_id: 'sess-1', room_id: 'room-abc' })

    // Create review succeeds
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'pr-seq', message_id: 'msg-seq' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    // All subsequent calls (polls + cleanup) return 200 with pending status
    const trackedUrls: string[] = []
    mockFetch.mockImplementation((...args: unknown[]) => {
      const request = args[0]
      const url = request instanceof Request ? request.url : String(request)
      trackedUrls.push(url)
      return Promise.resolve(
        new Response(JSON.stringify({ status: 'pending' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })

    await processPermissionReview(makeInput(), TEST_DIR, { pollInterval: 10, pollTimeout: 50 })

    // Total: 1 create + N polls + 1 expire + 1 timeout message
    expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(4)

    // Verify cleanup calls appear in tracked URLs
    const expireIndex = trackedUrls.findIndex(url => url.includes('expire'))
    const messageIndex = trackedUrls.findIndex(url => url.includes('messages'))
    expect(expireIndex).not.toBe(-1)
    expect(messageIndex).not.toBe(-1)
    // Expire is called before timeout message
    expect(expireIndex).toBeLessThan(messageIndex)
  })

  it('handles timeout message failure during cleanup — no crash', async () => {
    const { processPermissionReview } = await import('../../src/commands/hook/permission-review/usecase')
    writeTeamFile('my-team', { session_id: 'sess-1', room_id: 'room-abc' })

    // Create review succeeds
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'pr-notify-fail', message_id: 'msg-notify-fail' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    // Polls return pending; messages endpoint returns 500
    mockFetch.mockImplementation((...args: unknown[]) => {
      const request = args[0]
      const url = request instanceof Request ? request.url : String(request)

      if (url.includes('/messages')) {
        return Promise.resolve(
          new Response(JSON.stringify({ error: 'Internal Server Error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }

      return Promise.resolve(
        new Response(JSON.stringify({ status: 'pending' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })

    await processPermissionReview(makeInput(), TEST_DIR, { pollInterval: 10, pollTimeout: 50 })

    expect(stderrOutput).toContain('timed out:')
    expect(stdoutOutput).toBe('')
  })

  it('handles expire failure during cleanup — no crash', async () => {
    const { processPermissionReview } = await import('../../src/commands/hook/permission-review/usecase')
    writeTeamFile('my-team', { session_id: 'sess-1', room_id: 'room-abc' })

    // Create review succeeds
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'pr-expire-fail', message_id: 'msg-expire-fail' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    // Polls return pending; expire endpoint returns 500
    mockFetch.mockImplementation((...args: unknown[]) => {
      const request = args[0]
      const url = request instanceof Request ? request.url : String(request)

      if (url.includes('/expire')) {
        return Promise.resolve(
          new Response(JSON.stringify({ error: 'Internal Server Error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }

      return Promise.resolve(
        new Response(JSON.stringify({ status: 'pending' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })

    await processPermissionReview(makeInput(), TEST_DIR, { pollInterval: 10, pollTimeout: 50 })

    expect(stderrOutput).toContain('timed out:')
    expect(stdoutOutput).toBe('')
  })
})
