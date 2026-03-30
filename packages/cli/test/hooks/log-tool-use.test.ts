import { describe, expect, it, beforeEach, afterEach, mock } from 'bun:test'
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { processHookInput } from '@meet-ai/cli/commands/hook/log-tool-use/usecase'
import { setMeetAiDirOverride, writeHomeConfig } from '@meet-ai/cli/lib/meetai-home'
import { withMockFetch } from '../helpers/mock-fetch'

const TEST_DIR = '/tmp/meet-ai-hook-test-teams-cli'
const TEMP_MEET_AI_DIR = '/tmp/meet-ai-log-tool-use-test-home'
const TEMP_HOME = '/tmp/meet-ai-log-tool-use-test-fakehome'
const MSGID_DIR = '/tmp'
const savedHome = process.env.HOME

function writeTeamFile(data: { session_id: string; room_id: string }) {
  const dir = `${TEST_DIR}/test-team`
  mkdirSync(dir, { recursive: true })
  writeFileSync(`${dir}/meet-ai.json`, JSON.stringify(data))
}

describe('processHookInput', () => {
  withMockFetch(() => Promise.resolve(new Response('{}', { status: 201 })))

  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true })
    rmSync(TEMP_MEET_AI_DIR, { recursive: true, force: true })
    rmSync(TEMP_HOME, { recursive: true, force: true })
    mkdirSync(TEMP_HOME, { recursive: true })
    process.env.HOME = TEMP_HOME
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
    if (savedHome === undefined) delete process.env.HOME
    else process.env.HOME = savedHome
    rmSync(TEST_DIR, { recursive: true, force: true })
    rmSync(TEMP_MEET_AI_DIR, { recursive: true, force: true })
    rmSync(TEMP_HOME, { recursive: true, force: true })
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

  it('passes agent name as sender when transcript has agentName', async () => {
    writeTeamFile({ session_id: 'sess-1', room_id: 'room-1' })

    const transcriptPath = '/tmp/meet-ai-log-tool-use-agent-test.jsonl'
    writeFileSync(transcriptPath, JSON.stringify({ teamName: 'test-team', agentName: 'my-agent' }))

    const parentResponse = { id: 'msg-parent' }
    const logCalls: string[] = []

    const mockFetch = mock((url: string | URL | Request, init?: RequestInit) => {
      const urlStr = typeof url === 'string' ? url : url.toString()
      if (urlStr.includes('/logs')) {
        const body = JSON.parse(init?.body as string)
        logCalls.push(body.sender)
        return Promise.resolve(new Response('{}', { status: 201, headers: { 'Content-Type': 'application/json' } }))
      }
      return Promise.resolve(new Response(JSON.stringify(parentResponse), { status: 201, headers: { 'Content-Type': 'application/json' } }))
    }) as unknown as typeof fetch
    globalThis.fetch = mockFetch

    const input = JSON.stringify({
      session_id: 'sess-1',
      transcript_path: transcriptPath,
      tool_name: 'Grep',
      tool_input: { pattern: 'foo' },
    })
    const result = await processHookInput(input, TEST_DIR)

    expect(result).toBe('sent')
    expect(logCalls[0]).toBe('my-agent')
    rmSync(transcriptPath, { force: true })
  })

  it('persists spawned agent name to per-room config on teammate_spawned', async () => {
    writeTeamFile({ session_id: 'sess-1', room_id: 'room-spawn-1' })

    const mockFetch = mock(() =>
      Promise.resolve(new Response('{}', { status: 201, headers: { 'Content-Type': 'application/json' } }))
    ) as unknown as typeof fetch
    globalThis.fetch = mockFetch

    const input = JSON.stringify({
      session_id: 'sess-1',
      tool_name: 'Agent',
      tool_input: {},
      tool_response: {
        status: 'teammate_spawned',
        teammate_id: 'researcher@test-team',
        name: 'researcher',
        team_name: 'test-team',
        color: '#22c55e',
        agent_type: 'teammate',
        model: 'opus',
      },
    })

    const result = await processHookInput(input, TEST_DIR)
    expect(result).toBe('sent')

    // Verify the spawned agent name was persisted to per-room config in $HOME/.meet-ai/rooms/
    const homeDir = process.env.HOME ?? '/tmp'
    const configPath = join(homeDir, '.meet-ai', 'rooms', 'room-spawn-1', 'config.json')
    expect(existsSync(configPath)).toBe(true)
    const config = JSON.parse(readFileSync(configPath, 'utf-8'))
    expect(config.roomId).toBe('room-spawn-1')
    expect(config.usernames).toContain('researcher')

    // Clean up the room config
    rmSync(join(homeDir, '.meet-ai', 'rooms', 'room-spawn-1'), { recursive: true, force: true })
  })

  it('defaults sender to "hook" when agent name cannot be resolved', async () => {
    writeTeamFile({ session_id: 'sess-1', room_id: 'room-1' })

    const parentResponse = { id: 'msg-parent' }
    const logCalls: string[] = []

    const mockFetch = mock((url: string | URL | Request, init?: RequestInit) => {
      const urlStr = typeof url === 'string' ? url : url.toString()
      if (urlStr.includes('/logs')) {
        const body = JSON.parse(init?.body as string)
        logCalls.push(body.sender)
        return Promise.resolve(new Response('{}', { status: 201, headers: { 'Content-Type': 'application/json' } }))
      }
      return Promise.resolve(new Response(JSON.stringify(parentResponse), { status: 201, headers: { 'Content-Type': 'application/json' } }))
    }) as unknown as typeof fetch
    globalThis.fetch = mockFetch

    const input = JSON.stringify({
      session_id: 'sess-1',
      tool_name: 'Read',
      tool_input: { file_path: '/a/b.ts' },
    })
    const result = await processHookInput(input, TEST_DIR)

    expect(result).toBe('sent')
    expect(logCalls[0]).toBe('hook')
  })
})
