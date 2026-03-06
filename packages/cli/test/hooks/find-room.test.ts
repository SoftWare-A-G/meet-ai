import { describe, expect, it, beforeEach, afterEach } from 'bun:test'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { findRoomId } from '../../src/lib/hooks/find-room'

const TEST_DIR = '/tmp/meet-ai-hook-test-teams'

function writeTeamFile(teamName: string, data: { session_id: string; room_id: string; session_ids?: string[] }) {
  const dir = `${TEST_DIR}/${teamName}`
  mkdirSync(dir, { recursive: true })
  writeFileSync(`${dir}/meet-ai.json`, JSON.stringify(data))
}

function writeTranscript(path: string, lines: string[]) {
  writeFileSync(path, lines.join('\n'))
}

describe('findRoomId', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true })
  })

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
  })

  it('returns room_id when session matches', async () => {
    writeTeamFile('my-team', { session_id: 'sess-1', room_id: 'room-abc' })
    expect(await findRoomId('sess-1', TEST_DIR)).toBe('room-abc')
  })

  it('returns null when no session matches', async () => {
    writeTeamFile('my-team', { session_id: 'sess-other', room_id: 'room-abc' })
    expect(await findRoomId('sess-1', TEST_DIR)).toBeNull()
  })

  it('returns null when teams dir does not exist', async () => {
    expect(await findRoomId('sess-1', '/tmp/nonexistent-dir-12345')).toBeNull()
  })

  it('scans multiple team dirs', async () => {
    writeTeamFile('team-a', { session_id: 'sess-a', room_id: 'room-a' })
    writeTeamFile('team-b', { session_id: 'sess-b', room_id: 'room-b' })
    expect(await findRoomId('sess-b', TEST_DIR)).toBe('room-b')
  })

  it('skips malformed JSON files', async () => {
    const dir = `${TEST_DIR}/broken`
    mkdirSync(dir, { recursive: true })
    writeFileSync(`${dir}/meet-ai.json`, 'not json')
    expect(await findRoomId('sess-1', TEST_DIR)).toBeNull()
  })

  it('matches session in session_ids array', async () => {
    writeTeamFile('my-team', {
      session_id: 'lead-sess',
      room_id: 'room-abc',
      session_ids: ['lead-sess', 'teammate-sess'],
    })
    expect(await findRoomId('teammate-sess', TEST_DIR)).toBe('room-abc')
  })

  it('auto-registers session via transcript_path', async () => {
    writeTeamFile('my-team', { session_id: 'lead-sess', room_id: 'room-abc' })
    const transcriptPath = '/tmp/meet-ai-hook-test-transcript.jsonl'
    writeTranscript(transcriptPath, [
      JSON.stringify({ type: 'file-history-snapshot', messageId: '123' }),
      JSON.stringify({ teamName: 'my-team', type: 'progress', sessionId: 'new-sess' }),
    ])

    const result = await findRoomId('new-sess', TEST_DIR, transcriptPath)
    expect(result).toBe('room-abc')

    // Verify session was persisted
    const raw = JSON.parse(require('node:fs').readFileSync(`${TEST_DIR}/my-team/meet-ai.json`, 'utf-8'))
    expect(raw.session_ids).toContain('new-sess')
    expect(raw.session_ids).toContain('lead-sess')

    rmSync(transcriptPath, { force: true })
  })
})
