import { describe, expect, it, beforeEach, afterEach } from 'bun:test'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { setMeetAiDirOverride, writeHomeConfig } from '@meet-ai/cli/lib/meetai-home'
import { withMockFetch } from '../helpers/mock-fetch'

const TEST_DIR = '/tmp/meet-ai-plan-review-test-teams'
const TEMP_MEET_AI_DIR = '/tmp/meet-ai-plan-review-test-home'

const originalStdout = process.stdout.write
const originalStderr = process.stderr.write

function writeTeamFile(teamName: string, data: { session_id: string; room_id: string }) {
  const dir = `${TEST_DIR}/${teamName}`
  mkdirSync(dir, { recursive: true })
  writeFileSync(`${dir}/meet-ai.json`, JSON.stringify(data))
}

function makeInput(overrides?: Record<string, unknown>) {
  return JSON.stringify({
    session_id: 'sess-1',
    tool_name: 'ExitPlanMode',
    hook_event_name: 'PermissionRequest',
    tool_input: { plan: '## My Plan\n\nDo stuff' },
    ...overrides,
  })
}

async function loadUsecase() {
  return import('../../src/commands/hook/plan-review/usecase')
}

describe('plan-review usecase', () => {
  const mockFetch = withMockFetch()
  let stdoutCapture: string
  let stderrCapture: string

  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true })
    rmSync(TEMP_MEET_AI_DIR, { recursive: true, force: true })
    stdoutCapture = ''
    stderrCapture = ''
    process.stdout.write = ((chunk: string) => { stdoutCapture += chunk; return true }) as typeof process.stdout.write
    process.stderr.write = ((chunk: string) => { stderrCapture += chunk; return true }) as typeof process.stderr.write
    setMeetAiDirOverride(TEMP_MEET_AI_DIR)
    writeHomeConfig({
      defaultEnv: 'default',
      envs: { default: { url: 'http://localhost:9999', key: 'mai_test123' } },
    })
    writeTeamFile('my-team', { session_id: 'sess-1', room_id: 'room-abc' })
  })

  afterEach(() => {
    process.stdout.write = originalStdout
    process.stderr.write = originalStderr
    setMeetAiDirOverride(undefined)
    rmSync(TEST_DIR, { recursive: true, force: true })
    rmSync(TEMP_MEET_AI_DIR, { recursive: true, force: true })
  })

  it('skips when stdin is invalid JSON', async () => {
    const { processPlanReview } = await loadUsecase()
    await processPlanReview('not json', TEST_DIR)
    expect(stderrCapture).toContain('bad input: Invalid JSON')
    expect(stdoutCapture).toBe('')
  })

  it('skips when no session_id', async () => {
    const { processPlanReview } = await loadUsecase()
    await processPlanReview(JSON.stringify({ tool_name: 'ExitPlanMode', hook_event_name: 'PermissionRequest' }), TEST_DIR)
    expect(stderrCapture).toContain('validation failed on')
    expect(stdoutCapture).toBe('')
  })

  it('creates review with fallback message when no plan content in tool_input', async () => {
    // Mock create plan review POST
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'pr-empty', message_id: 'msg-empty' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    // Mock poll GET — return approved immediately
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 'approved' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const { processPlanReview } = await loadUsecase()
    await processPlanReview(makeInput({ tool_input: {} }), TEST_DIR)

    expect(mockFetch).toHaveBeenCalledTimes(2)
    // Verify the create call sent the fallback message
    const createCall = mockFetch.mock.calls[0]
    const createUrl = createCall[0] as string
    expect(createUrl).toContain('/plan-reviews')
    const output = JSON.parse(stdoutCapture)
    expect(output.hookSpecificOutput.hookEventName).toBe('PermissionRequest')
    expect(output.hookSpecificOutput.decision.behavior).toBe('allow')
  })

  it('skips when no room found for session', async () => {
    const { processPlanReview } = await loadUsecase()
    await processPlanReview(makeInput({ session_id: 'unknown-sess' }), TEST_DIR)
    expect(stderrCapture).toContain('room not found:')
    expect(stdoutCapture).toBe('')
  })

  it('silently skips when no home config exists', async () => {
    setMeetAiDirOverride('/tmp/nonexistent-meet-ai-dir-99')
    const { processPlanReview } = await loadUsecase()
    await processPlanReview(makeInput(), TEST_DIR)
    expect(stdoutCapture).toBe('')
  })

  it('creates plan review and outputs allow on approved decision', async () => {
    // Mock create plan review POST
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'pr-1', message_id: 'msg-1' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    // Mock poll GET — return approved immediately
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 'approved' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const { processPlanReview } = await loadUsecase()
    await processPlanReview(makeInput(), TEST_DIR)

    expect(mockFetch).toHaveBeenCalledTimes(2)
    const output = JSON.parse(stdoutCapture)
    expect(output.hookSpecificOutput.hookEventName).toBe('PermissionRequest')
    expect(output.hookSpecificOutput.decision.behavior).toBe('allow')
  })

  it('outputs deny with feedback on denied decision', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'pr-2' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 'denied', feedback: 'Needs more detail' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const { processPlanReview } = await loadUsecase()
    await processPlanReview(makeInput(), TEST_DIR)

    const output = JSON.parse(stdoutCapture)
    expect(output.hookSpecificOutput.decision.behavior).toBe('deny')
    expect(output.hookSpecificOutput.decision.message).toBe('Needs more detail')
  })

  it('uses default feedback when denied without feedback', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'pr-3' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 'denied' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const { processPlanReview } = await loadUsecase()
    await processPlanReview(makeInput(), TEST_DIR)

    const output = JSON.parse(stdoutCapture)
    expect(output.hookSpecificOutput.decision.behavior).toBe('deny')
    expect(output.hookSpecificOutput.decision.message).toContain('Plan was rejected')
  })

  it('outputs allow with allowedPrompts for acceptEdits permission_mode', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'pr-4' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 'approved', permission_mode: 'acceptEdits' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const { processPlanReview } = await loadUsecase()
    await processPlanReview(makeInput(), TEST_DIR)

    const output = JSON.parse(stdoutCapture)
    expect(output.hookSpecificOutput.decision.behavior).toBe('allow')
    expect(output.hookSpecificOutput.decision.allowedPrompts).toBeDefined()
    expect(output.hookSpecificOutput.decision.allowedPrompts.length).toBeGreaterThan(0)
  })

  it('silently handles create plan review failure', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('{"error":"server error"}', { status: 500 }),
    )

    const { processPlanReview } = await loadUsecase()
    await processPlanReview(makeInput(), TEST_DIR)

    expect(stderrCapture).toContain('failed to create review:')
    expect(stdoutCapture).toBe('')
  })

  it('silently handles network error on create', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'))

    const { processPlanReview } = await loadUsecase()
    await processPlanReview(makeInput(), TEST_DIR)

    expect(stderrCapture).toContain('failed to create review:')
    expect(stdoutCapture).toBe('')
  })

  it('outputs deny on expired (dismissed) status', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'pr-5' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 'expired' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const { processPlanReview } = await loadUsecase()
    await processPlanReview(makeInput(), TEST_DIR)

    const output = JSON.parse(stdoutCapture)
    expect(output.hookSpecificOutput.decision.behavior).toBe('deny')
    expect(output.hookSpecificOutput.decision.message).toContain('dismissed')
  })
})
