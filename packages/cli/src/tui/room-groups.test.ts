import { describe, expect, it } from 'bun:test'
import { groupTeamsByRoom, worstStatus } from './room-groups'
import type { TeamProcess } from '@meet-ai/cli/lib/process-manager'

function makeTeam(overrides: Partial<TeamProcess> & { teamId: string; roomId: string }): TeamProcess {
  return {
    roomName: 'test-room',
    codingAgent: 'claude',
    sessionName: `mai-${overrides.teamId}`,
    status: 'running',
    exitCode: null,
    lines: [],
    panes: [],
    ...overrides,
  }
}

describe('room-groups', () => {
  it('groups teams by roomId preserving insertion order', () => {
    const teams = [
      makeTeam({ teamId: 'room-1', roomId: 'room-1', roomName: 'Alpha' }),
      makeTeam({ teamId: 'room-2', roomId: 'room-2', roomName: 'Beta' }),
      makeTeam({ teamId: 'room-1-2', roomId: 'room-1', roomName: 'Alpha', codingAgent: 'codex' }),
    ]

    const groups = groupTeamsByRoom(teams)
    expect(groups).toHaveLength(2)
    expect(groups[0]!.roomId).toBe('room-1')
    expect(groups[0]!.teams).toHaveLength(2)
    expect(groups[0]!.teams[0]!.codingAgent).toBe('claude')
    expect(groups[0]!.teams[1]!.codingAgent).toBe('codex')
    expect(groups[1]!.roomId).toBe('room-2')
    expect(groups[1]!.teams).toHaveLength(1)
  })

  it('returns empty array for no teams', () => {
    expect(groupTeamsByRoom([])).toEqual([])
  })

  it('worstStatus returns the highest-priority status', () => {
    expect(worstStatus([
      makeTeam({ teamId: 'a', roomId: 'r', status: 'running' }),
      makeTeam({ teamId: 'b', roomId: 'r', status: 'error' }),
    ])).toBe('error')

    expect(worstStatus([
      makeTeam({ teamId: 'a', roomId: 'r', status: 'running' }),
      makeTeam({ teamId: 'b', roomId: 'r', status: 'starting' }),
    ])).toBe('starting')

    expect(worstStatus([
      makeTeam({ teamId: 'a', roomId: 'r', status: 'exited' }),
    ])).toBe('exited')
  })
})
