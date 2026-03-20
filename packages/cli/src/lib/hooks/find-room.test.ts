import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { findRoom } from './find-room'

describe('findRoom fallback path: ~/.meet-ai/teams → ~/.claude/teams', () => {
  const tempHome = '/tmp/meet-ai-find-room-fallback'
  const savedHome = process.env.HOME
  const SESSION = 'sess-abc-123'
  const ROOM_ID = 'room-00000000-0000-0000-0000-000000000001'

  function writeMeetAi(teamDir: string, data: Record<string, unknown>) {
    mkdirSync(teamDir, { recursive: true })
    writeFileSync(`${teamDir}/meet-ai.json`, JSON.stringify(data))
  }

  beforeEach(() => {
    rmSync(tempHome, { recursive: true, force: true })
    mkdirSync(tempHome, { recursive: true })
    process.env.HOME = tempHome
  })

  afterEach(() => {
    rmSync(tempHome, { recursive: true, force: true })
    if (savedHome === undefined) delete process.env.HOME
    else process.env.HOME = savedHome
  })

  it('finds room in the primary ~/.meet-ai/teams directory', async () => {
    writeMeetAi(`${tempHome}/.meet-ai/teams/my-team`, {
      session_id: SESSION,
      room_id: ROOM_ID,
      team_name: 'my-team',
    })

    const result = await findRoom(SESSION)
    expect(result).toEqual({
      roomId: ROOM_ID,
      teamName: 'my-team',
      agentName: undefined,
    })
  })

  it('falls back to ~/.claude/teams when primary has no match', async () => {
    // Primary dir exists but is empty
    mkdirSync(`${tempHome}/.meet-ai/teams`, { recursive: true })

    writeMeetAi(`${tempHome}/.claude/teams/legacy-team`, {
      session_id: SESSION,
      room_id: ROOM_ID,
      team_name: 'legacy-team',
    })

    const result = await findRoom(SESSION)
    expect(result).toEqual({
      roomId: ROOM_ID,
      teamName: 'legacy-team',
      agentName: undefined,
    })
  })

  it('falls back to ~/.claude/teams when primary dir does not exist', async () => {
    // Don't create ~/.meet-ai/teams at all

    writeMeetAi(`${tempHome}/.claude/teams/legacy-team`, {
      session_id: SESSION,
      room_id: ROOM_ID,
      team_name: 'legacy-team',
    })

    const result = await findRoom(SESSION)
    expect(result).toEqual({
      roomId: ROOM_ID,
      teamName: 'legacy-team',
      agentName: undefined,
    })
  })

  it('primary wins when both directories have a match', async () => {
    writeMeetAi(`${tempHome}/.meet-ai/teams/primary-team`, {
      session_id: SESSION,
      room_id: 'room-primary',
      team_name: 'primary-team',
    })

    writeMeetAi(`${tempHome}/.claude/teams/legacy-team`, {
      session_id: SESSION,
      room_id: 'room-legacy',
      team_name: 'legacy-team',
    })

    const result = await findRoom(SESSION)
    expect(result).toEqual({
      roomId: 'room-primary',
      teamName: 'primary-team',
      agentName: undefined,
    })
  })

  it('returns null when neither directory has a match', async () => {
    mkdirSync(`${tempHome}/.meet-ai/teams/other`, { recursive: true })
    writeFileSync(
      `${tempHome}/.meet-ai/teams/other/meet-ai.json`,
      JSON.stringify({ session_id: 'different-session', room_id: 'room-x' })
    )

    const result = await findRoom(SESSION)
    expect(result).toBeNull()
  })
})
