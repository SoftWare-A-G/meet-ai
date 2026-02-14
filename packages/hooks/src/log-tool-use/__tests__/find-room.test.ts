import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { findRoomId } from '../find-room'

const TEST_DIR = '/tmp/meet-ai-hook-test-teams'

function writeTeamFile(teamName: string, data: { session_id: string; room_id: string }) {
  const dir = `${TEST_DIR}/${teamName}`
  mkdirSync(dir, { recursive: true })
  writeFileSync(`${dir}/meet-ai.json`, JSON.stringify(data))
}

describe('findRoomId', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true })
  })

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
  })

  it('returns room_id when session matches', () => {
    writeTeamFile('my-team', { session_id: 'sess-1', room_id: 'room-abc' })
    expect(findRoomId('sess-1', TEST_DIR)).toBe('room-abc')
  })

  it('returns null when no session matches', () => {
    writeTeamFile('my-team', { session_id: 'sess-other', room_id: 'room-abc' })
    expect(findRoomId('sess-1', TEST_DIR)).toBeNull()
  })

  it('returns null when teams dir does not exist', () => {
    expect(findRoomId('sess-1', '/tmp/nonexistent-dir-12345')).toBeNull()
  })

  it('scans multiple team dirs', () => {
    writeTeamFile('team-a', { session_id: 'sess-a', room_id: 'room-a' })
    writeTeamFile('team-b', { session_id: 'sess-b', room_id: 'room-b' })
    expect(findRoomId('sess-b', TEST_DIR)).toBe('room-b')
  })

  it('skips malformed JSON files', () => {
    const dir = `${TEST_DIR}/broken`
    mkdirSync(dir, { recursive: true })
    writeFileSync(`${dir}/meet-ai.json`, 'not json')
    expect(findRoomId('sess-1', TEST_DIR)).toBeNull()
  })
})
