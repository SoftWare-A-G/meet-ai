import { describe, expect, it, beforeEach, afterEach } from 'bun:test'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { setMeetAiDirOverride, writeHomeConfig } from '@meet-ai/cli/lib/meetai-home'
import { withMockFetch } from '../helpers/mock-fetch'

const TEST_DIR = '/tmp/meet-ai-qr-test-teams'
const TEMP_MEET_AI_DIR = '/tmp/meet-ai-qr-test-home'

function writeTeamFile(teamName: string, data: { session_id: string; room_id: string }) {
  const dir = `${TEST_DIR}/${teamName}`
  mkdirSync(dir, { recursive: true })
  writeFileSync(`${dir}/meet-ai.json`, JSON.stringify(data))
}

function makeInput(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    session_id: 'sess-1',
    hook_event_name: 'PermissionRequest',
    tool_name: 'AskUser',
    tool_input: {
      questions: [
        {
          question: 'Pick a color',
          options: [{ label: 'Red', description: 'A warm color' }, { label: 'Blue' }],
        },
      ],
    },
    ...overrides,
  })
}

describe('processQuestionReview', () => {
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
    delete process.env.MEET_AI_RUNTIME
    delete process.env.MEET_AI_CODEX_SESSION_ID
    delete process.env.CODEX_HOME
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
    const { processQuestionReview } =
      await import('../../src/commands/hook/question-review/usecase')
    await processQuestionReview('not json', TEST_DIR)
    expect(stderrOutput).toContain('failed to parse stdin')
    expect(stdoutOutput).toBe('')
  })

  it('skips when session_id is missing', async () => {
    const { processQuestionReview } =
      await import('../../src/commands/hook/question-review/usecase')
    await processQuestionReview(makeInput({ session_id: '' }), TEST_DIR)
    expect(stderrOutput).toContain('missing session_id or questions')
    expect(stdoutOutput).toBe('')
  })

  it('skips when questions array is empty', async () => {
    const { processQuestionReview } =
      await import('../../src/commands/hook/question-review/usecase')
    await processQuestionReview(makeInput({ tool_input: { questions: [] } }), TEST_DIR)
    expect(stderrOutput).toContain('missing session_id or questions')
    expect(stdoutOutput).toBe('')
  })

  it('skips when no room found for session', async () => {
    const { processQuestionReview } =
      await import('../../src/commands/hook/question-review/usecase')
    // No team file written — room lookup will fail
    await processQuestionReview(makeInput(), TEST_DIR)
    expect(stderrOutput).toContain('no room found for session')
    expect(stdoutOutput).toBe('')
  })

  it('silently skips when no home config exists', async () => {
    const { processQuestionReview } =
      await import('../../src/commands/hook/question-review/usecase')
    writeTeamFile('my-team', { session_id: 'sess-1', room_id: 'room-abc' })
    setMeetAiDirOverride('/tmp/nonexistent-meet-ai-dir-99')
    await processQuestionReview(makeInput(), TEST_DIR)
    expect(stdoutOutput).toBe('')
  })

  it('creates question review and outputs answers on success', async () => {
    const { processQuestionReview } =
      await import('../../src/commands/hook/question-review/usecase')
    writeTeamFile('my-team', { session_id: 'sess-1', room_id: 'room-abc' })

    // Mock create review
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'qr-1', message_id: 'msg-1' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    // Mock poll — answered immediately
    const answers = { 'Pick a color': 'Red' }
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 'answered', answers_json: JSON.stringify(answers) }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    await processQuestionReview(makeInput(), TEST_DIR, { pollInterval: 10, pollTimeout: 500 })

    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(stdoutOutput).not.toBe('')
    const output = JSON.parse(stdoutOutput)
    expect(output.hookSpecificOutput.hookEventName).toBe('PermissionRequest')
    expect(output.hookSpecificOutput.decision.behavior).toBe('allow')
    expect(output.hookSpecificOutput.decision.updatedInput.answers).toEqual(answers)
  })

  it('handles pending then answered poll', async () => {
    const { processQuestionReview } =
      await import('../../src/commands/hook/question-review/usecase')
    writeTeamFile('my-team', { session_id: 'sess-1', room_id: 'room-abc' })

    // Mock create review
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'qr-2' }), {
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

    // Second poll — answered
    const answers = { 'Pick a color': 'Blue' }
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 'answered', answers_json: JSON.stringify(answers) }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    await processQuestionReview(makeInput(), TEST_DIR, { pollInterval: 10, pollTimeout: 500 })

    expect(mockFetch).toHaveBeenCalledTimes(3)
    const output = JSON.parse(stdoutOutput)
    expect(output.hookSpecificOutput.decision.updatedInput.answers).toEqual(answers)
  })

  it('handles expired status — no stdout output', async () => {
    const { processQuestionReview } =
      await import('../../src/commands/hook/question-review/usecase')
    writeTeamFile('my-team', { session_id: 'sess-1', room_id: 'room-abc' })

    // Mock create review
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'qr-3' }), {
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

    await processQuestionReview(makeInput(), TEST_DIR, { pollInterval: 10, pollTimeout: 500 })

    expect(stdoutOutput).toBe('')
    expect(stderrOutput).toContain('answer received: expired')
  })

  it('handles malformed answers_json gracefully (hardening)', async () => {
    const { processQuestionReview } =
      await import('../../src/commands/hook/question-review/usecase')
    writeTeamFile('my-team', { session_id: 'sess-1', room_id: 'room-abc' })

    // Mock create review
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'qr-4' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    // Poll returns answered but with broken JSON
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 'answered', answers_json: '{broken json!!!' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    await processQuestionReview(makeInput(), TEST_DIR, { pollInterval: 10, pollTimeout: 500 })

    // Must not write to stdout on parse failure
    expect(stdoutOutput).toBe('')
    expect(stderrOutput).toContain('failed to parse answers_json')
  })

  it('handles create review failure', async () => {
    const { processQuestionReview } =
      await import('../../src/commands/hook/question-review/usecase')
    writeTeamFile('my-team', { session_id: 'sess-1', room_id: 'room-abc' })

    // Mock create review — server error
    mockFetch.mockResolvedValueOnce(new Response('Internal Server Error', { status: 500 }))

    await processQuestionReview(makeInput(), TEST_DIR, { pollInterval: 10, pollTimeout: 500 })

    expect(stdoutOutput).toBe('')
    expect(stderrOutput).toContain('create failed: 500')
  })

  it('handles poll timeout — sends timeout message and expires review', async () => {
    const { processQuestionReview } =
      await import('../../src/commands/hook/question-review/usecase')
    writeTeamFile('my-team', { session_id: 'sess-1', room_id: 'room-abc' })

    // Mock create review
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'qr-5' }), {
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
    await processQuestionReview(makeInput(), TEST_DIR, { pollInterval: 10, pollTimeout: 50 })

    expect(stdoutOutput).toBe('')
    expect(stderrOutput).toContain('timed out waiting for answer')
  })

  it('never throws — always exits cleanly on fetch network error', async () => {
    const { processQuestionReview } =
      await import('../../src/commands/hook/question-review/usecase')
    writeTeamFile('my-team', { session_id: 'sess-1', room_id: 'room-abc' })

    // Mock create review — network error
    mockFetch.mockRejectedValueOnce(new Error('Network failure'))

    await processQuestionReview(makeInput(), TEST_DIR, { pollInterval: 10, pollTimeout: 500 })

    expect(stdoutOutput).toBe('')
    expect(stderrOutput).toContain('create error')
  })
})
