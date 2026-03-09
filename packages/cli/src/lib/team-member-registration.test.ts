import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'

const mockCreateHookClient = mock(() => ({ api: {} }))
const mockSendTeamMemberUpsert = mock(() => Promise.resolve())

mock.module('./hooks/client', () => ({
  createHookClient: mockCreateHookClient,
  sendTeamMemberUpsert: mockSendTeamMemberUpsert,
}))

const { registerActiveTeamMember } = await import('./team-member-registration')

describe('registerActiveTeamMember', () => {
  const tempHome = '/tmp/meet-ai-team-member-registration'
  const savedHome = process.env.HOME
  const savedUrl = process.env.MEET_AI_URL
  const savedKey = process.env.MEET_AI_KEY
  const savedAgentName = process.env.MEET_AI_AGENT_NAME
  const savedColor = process.env.MEET_AI_COLOR

  beforeEach(() => {
    rmSync(tempHome, { recursive: true, force: true })
    mkdirSync(`${tempHome}/.claude/teams/demo-team`, { recursive: true })
    process.env.HOME = tempHome
    process.env.MEET_AI_URL = 'https://meet-ai.test'
    process.env.MEET_AI_KEY = 'test-key'
    delete process.env.MEET_AI_AGENT_NAME
    delete process.env.MEET_AI_COLOR
    mockCreateHookClient.mockClear()
    mockSendTeamMemberUpsert.mockClear()
  })

  afterEach(() => {
    rmSync(tempHome, { recursive: true, force: true })
    if (savedHome === undefined) delete process.env.HOME
    else process.env.HOME = savedHome
    if (savedUrl === undefined) delete process.env.MEET_AI_URL
    else process.env.MEET_AI_URL = savedUrl
    if (savedKey === undefined) delete process.env.MEET_AI_KEY
    else process.env.MEET_AI_KEY = savedKey
    if (savedAgentName === undefined) delete process.env.MEET_AI_AGENT_NAME
    else process.env.MEET_AI_AGENT_NAME = savedAgentName
    if (savedColor === undefined) delete process.env.MEET_AI_COLOR
    else process.env.MEET_AI_COLOR = savedColor
  })

  it('uses team config metadata for the lead agent when only team name is provided', async () => {
    writeFileSync(
      `${tempHome}/.claude/teams/demo-team/config.json`,
      JSON.stringify({
        leadAgentId: 'team-lead@demo-team',
        members: [
          {
            agentId: 'team-lead@demo-team',
            name: 'team-lead',
            agentType: 'team-lead',
            model: 'claude-opus-4-6',
            joinedAt: 12345,
          },
        ],
      })
    )

    await registerActiveTeamMember({
      roomId: '30c9e52e-5f4d-4298-a995-efb5c27623d6',
      teamName: 'demo-team',
    })

    expect(mockCreateHookClient).toHaveBeenCalledWith('https://meet-ai.test', 'test-key')
    expect(mockSendTeamMemberUpsert).toHaveBeenCalledWith(
      { api: {} },
      '30c9e52e-5f4d-4298-a995-efb5c27623d6',
      'demo-team',
      {
        teammate_id: 'team-lead@demo-team',
        name: 'team-lead',
        color: '#3b82f6',
        role: 'team-lead',
        model: 'claude-opus-4-6',
        status: 'active',
        joinedAt: 12345,
      }
    )
  })

  it('resolves the team name from room bindings for codex registration', async () => {
    writeFileSync(
      `${tempHome}/.claude/teams/demo-team/meet-ai.json`,
      JSON.stringify({
        room_id: '30c9e52e-5f4d-4298-a995-efb5c27623d6',
        team_name: 'demo-team',
      })
    )

    await registerActiveTeamMember({
      roomId: '30c9e52e-5f4d-4298-a995-efb5c27623d6',
      agentName: 'codex',
      role: 'codex',
    })

    expect(mockSendTeamMemberUpsert).toHaveBeenCalledWith(
      { api: {} },
      '30c9e52e-5f4d-4298-a995-efb5c27623d6',
      'demo-team',
      {
        teammate_id: 'codex@demo-team',
        name: 'codex',
        color: '#22c55e',
        role: 'codex',
        model: 'unknown',
        status: 'active',
        joinedAt: expect.any(Number),
      }
    )
  })
})
