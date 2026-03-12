import { describe, expect, it, beforeEach, afterEach, mock } from 'bun:test'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { processHookInput } from '@meet-ai/cli/commands/hook/log-tool-use/usecase'
import { setMeetAiDirOverride, writeHomeConfig } from '@meet-ai/cli/lib/meetai-home'

const TEST_DIR = '/tmp/meet-ai-hook-test-teams-cli'
const TEMP_MEET_AI_DIR = '/tmp/meet-ai-log-tool-use-test-home'
const MSGID_DIR = '/tmp'

function writeTeamFile(data: { session_id: string; room_id: string }) {
  const dir = `${TEST_DIR}/test-team`
  mkdirSync(dir, { recursive: true })
  writeFileSync(`${dir}/meet-ai.json`, JSON.stringify(data))
}

const originalFetch = globalThis.fetch

describe('processHookInput', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true })
    rmSync(TEMP_MEET_AI_DIR, { recursive: true, force: true })
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response('{}', { status: 201 }))
    ) as unknown as typeof fetch
    setMeetAiDirOverride(TEMP_MEET_AI_DIR)
    writeHomeConfig({
      defaultEnv: 'default',
      envs: { default: { url: 'http://localhost:9999', key: 'mai_test123' } },
    })
    delete process.env.MEET_AI_RUNTIME
    delete process.env.MEET_AI_CODEX_SESSION_ID
    delete process.env.CODEX_HOME
  })

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
    rmSync(TEMP_MEET_AI_DIR, { recursive: true, force: true })
    globalThis.fetch = originalFetch
    setMeetAiDirOverride(undefined)
    // Clean up msgid files
    try {
      rmSync(`${MSGID_DIR}/meet-ai-hook-sess-1.msgid`)
    } catch {}
  })

  it('skips when JSON is invalid', async () => {
    const result = await processHookInput('not json', TEST_DIR)
    expect(result).toBe('skip')
  })

  it('skips when no session_id', async () => {
    const result = await processHookInput('{}', TEST_DIR)
    expect(result).toBe('skip')
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('skips when no tool_name', async () => {
    const input = JSON.stringify({ session_id: 'sess-1' })
    const result = await processHookInput(input, TEST_DIR)
    expect(result).toBe('skip')
  })

  it('skips when tool is SendMessage', async () => {
    const input = JSON.stringify({
      session_id: 'sess-1',
      tool_name: 'SendMessage',
      tool_input: {},
    })
    const result = await processHookInput(input, TEST_DIR)
    expect(result).toBe('skip')
  })

  it('skips Bash commands starting with meet-ai', async () => {
    const input = JSON.stringify({
      session_id: 'sess-1',
      tool_name: 'Bash',
      tool_input: { command: 'meet-ai send-message room test' },
    })
    const result = await processHookInput(input, TEST_DIR)
    expect(result).toBe('skip')
  })

  it('skips Bash commands starting with cd', async () => {
    const input = JSON.stringify({
      session_id: 'sess-1',
      tool_name: 'Bash',
      tool_input: { command: 'cd /foo/bar' },
    })
    const result = await processHookInput(input, TEST_DIR)
    expect(result).toBe('skip')
  })

  it('skips when no room found for session', async () => {
    writeTeamFile({ session_id: 'other', room_id: 'room-1' })
    const input = JSON.stringify({
      session_id: 'sess-1',
      tool_name: 'Read',
      tool_input: { file_path: '/a/b.ts' },
    })
    const result = await processHookInput(input, TEST_DIR)
    expect(result).toBe('skip')
  })

  it('skips when no team files exist', async () => {
    const input = JSON.stringify({
      session_id: 'sess-1',
      tool_name: 'Read',
      tool_input: { file_path: '/a/b.ts' },
    })
    const result = await processHookInput(input, '/tmp/nonexistent-dir-99999')
    expect(result).toBe('skip')
  })

  it('silently skips when no home config exists', async () => {
    setMeetAiDirOverride('/tmp/nonexistent-meet-ai-dir-99')
    writeTeamFile({ session_id: 'sess-1', room_id: 'room-1' })
    const input = JSON.stringify({
      session_id: 'sess-1',
      tool_name: 'Read',
      tool_input: { file_path: '/a/b.ts' },
    })
    const result = await processHookInput(input, TEST_DIR)
    expect(result).toBe('skip')
  })

  it('creates parent message and sends log entry', async () => {
    writeTeamFile({ session_id: 'sess-1', room_id: 'room-1' })

    const parentResponse = {
      id: 'msg-parent',
      room_id: 'room-1',
      sender: 'hook',
      content: 'Agent activity',
      sender_type: 'agent',
      color: '#6b7280',
      type: 'message',
      seq: 1,
      created_at: '2026-01-01',
      attachment_count: 0,
    }
    const logResponse = {
      id: 'log-1',
      room_id: 'room-1',
      message_id: 'msg-parent',
      sender: 'hook',
      content: 'Read: b.ts',
      color: '#6b7280',
      type: 'log',
      created_at: '2026-01-01',
    }

    const mockFetch = mock((url: string | URL | Request) => {
      const urlStr = typeof url === 'string' ? url : url.toString()
      if (urlStr.includes('/logs')) {
        return Promise.resolve(
          new Response(JSON.stringify(logResponse), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      }
      return Promise.resolve(
        new Response(JSON.stringify(parentResponse), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    }) as unknown as typeof fetch

    globalThis.fetch = mockFetch

    const input = JSON.stringify({
      session_id: 'sess-1',
      tool_name: 'Read',
      tool_input: { file_path: '/a/b.ts' },
    })
    const result = await processHookInput(input, TEST_DIR)

    expect(result).toBe('sent')
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })
})
