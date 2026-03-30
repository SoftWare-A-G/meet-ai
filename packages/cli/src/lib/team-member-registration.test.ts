import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { setMeetAiDirOverride, writeHomeConfig } from '@meet-ai/cli/lib/meetai-home'

const TEMP_MEET_AI_DIR = '/tmp/meet-ai-team-member-registration-home'

const mockCreateHookClient = mock(() => ({ api: {} }))
const mockGetTeamInfo = mock(() => Promise.resolve(null as any))
const mockSendTeamMemberUpsert = mock(() => Promise.resolve())
const mockSendParentMessage = mock(() => Promise.resolve(null))
const mockSendLogEntry = mock(() => Promise.resolve())

mock.module('./hooks/client', () => ({
  createHookClient: mockCreateHookClient,
  getTeamInfo: mockGetTeamInfo,
  sendLogEntry: mockSendLogEntry,
  sendParentMessage: mockSendParentMessage,
  sendTeamMemberUpsert: mockSendTeamMemberUpsert,
}))

const { registerActiveTeamMember } = await import('./team-member-registration')

describe('registerActiveTeamMember', () => {
  const tempHome = '/tmp/meet-ai-team-member-registration'
  const savedHome = process.env.HOME
  const savedAgentName = process.env.MEET_AI_AGENT_NAME
  const savedColor = process.env.MEET_AI_COLOR

  beforeEach(() => {
    rmSync(tempHome, { recursive: true, force: true })
    mkdirSync(`${tempHome}/.claude/teams/demo-team`, { recursive: true })
    process.env.HOME = tempHome
    delete process.env.MEET_AI_AGENT_NAME
    delete process.env.MEET_AI_COLOR
    rmSync(TEMP_MEET_AI_DIR, { recursive: true, force: true })
    setMeetAiDirOverride(TEMP_MEET_AI_DIR)
    writeHomeConfig({
      defaultEnv: 'default',
      envs: { default: { url: 'https://meet-ai.test', key: 'mai_test_key123' } },
    })
    mockCreateHookClient.mockClear()
    mockGetTeamInfo.mockClear()
    mockGetTeamInfo.mockResolvedValue(null as any)
    mockSendTeamMemberUpsert.mockClear()
  })

  afterEach(() => {
    rmSync(tempHome, { recursive: true, force: true })
    rmSync(TEMP_MEET_AI_DIR, { recursive: true, force: true })
    setMeetAiDirOverride(undefined)
    if (savedHome === undefined) delete process.env.HOME
    else process.env.HOME = savedHome
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

    expect(mockCreateHookClient).toHaveBeenCalledWith('https://meet-ai.test', 'mai_test_key123')
    expect(
      JSON.parse(
        readFileSync(
          `${tempHome}/.meet-ai/rooms/30c9e52e-5f4d-4298-a995-efb5c27623d6/config.json`,
          'utf-8'
        )
      )
    ).toEqual({
      roomId: '30c9e52e-5f4d-4298-a995-efb5c27623d6',
      usernames: ['team-lead'],
    })
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
    mkdirSync(`${tempHome}/.meet-ai/teams/demo-team`, { recursive: true })
    writeFileSync(
      `${tempHome}/.meet-ai/teams/demo-team/meet-ai.json`,
      JSON.stringify({
        room_id: '30c9e52e-5f4d-4298-a995-efb5c27623d6',
        team_name: 'demo-team',
      })
    )

    await registerActiveTeamMember({
      roomId: '30c9e52e-5f4d-4298-a995-efb5c27623d6',
      agentName: 'codex',
      role: 'codex',
      model: 'gpt-5.4 (high)',
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
        model: 'gpt-5.4 (high)',
        status: 'active',
        joinedAt: expect.any(Number),
      }
    )
  })

  it('falls back to ~/.claude/teams when primary has no room binding', async () => {
    // Primary dir exists but is empty (no meet-ai.json matching this room)
    mkdirSync(`${tempHome}/.meet-ai/teams`, { recursive: true })

    // Legacy dir has the binding
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
      model: 'gpt-5',
    })

    expect(mockSendTeamMemberUpsert).toHaveBeenCalledWith(
      { api: {} },
      '30c9e52e-5f4d-4298-a995-efb5c27623d6',
      'demo-team',
      expect.objectContaining({ name: 'codex', role: 'codex' })
    )
  })

  it('prefers primary ~/.meet-ai/teams over ~/.claude/teams for room binding', async () => {
    mkdirSync(`${tempHome}/.meet-ai/teams/primary-team`, { recursive: true })
    writeFileSync(
      `${tempHome}/.meet-ai/teams/primary-team/meet-ai.json`,
      JSON.stringify({
        room_id: '30c9e52e-5f4d-4298-a995-efb5c27623d6',
        team_name: 'primary-team',
      })
    )
    writeFileSync(
      `${tempHome}/.claude/teams/demo-team/meet-ai.json`,
      JSON.stringify({
        room_id: '30c9e52e-5f4d-4298-a995-efb5c27623d6',
        team_name: 'legacy-team',
      })
    )

    await registerActiveTeamMember({
      roomId: '30c9e52e-5f4d-4298-a995-efb5c27623d6',
      agentName: 'codex',
      role: 'codex',
      model: 'gpt-5',
    })

    // Should use 'primary-team' from ~/.meet-ai/teams, not 'legacy-team' from ~/.claude/teams
    expect(mockSendTeamMemberUpsert).toHaveBeenCalledWith(
      { api: {} },
      '30c9e52e-5f4d-4298-a995-efb5c27623d6',
      'primary-team',
      expect.objectContaining({ name: 'codex' })
    )
  })

  it('reuses the existing room member id when local room bindings are missing', async () => {
    mockGetTeamInfo.mockResolvedValue({
      type: 'team_info',
      team_name: 'demo-team',
      members: [
        {
          teammate_id: 'codex@demo-team',
          name: 'codex',
          color: '#22c55e',
          role: 'codex',
          model: 'unknown',
          status: 'active',
          joinedAt: 111,
        },
      ],
    } as any)

    await registerActiveTeamMember({
      roomId: '30c9e52e-5f4d-4298-a995-efb5c27623d6',
      agentName: 'codex',
      role: 'codex',
      model: 'gpt-5',
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
        model: 'gpt-5',
        status: 'active',
        joinedAt: expect.any(Number),
      }
    )
  })
})
