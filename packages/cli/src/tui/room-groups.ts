import type { TeamProcess, ProcessStatus } from '@meet-ai/cli/lib/process-manager'

export interface RoomGroup {
  roomId: string
  roomName: string
  teams: TeamProcess[]
}

export function groupTeamsByRoom(teams: TeamProcess[]): RoomGroup[] {
  const groups = new Map<string, RoomGroup>()
  for (const team of teams) {
    let group = groups.get(team.roomId)
    if (!group) {
      group = { roomId: team.roomId, roomName: team.roomName, teams: [] }
      groups.set(team.roomId, group)
    }
    group.teams.push(team)
  }
  return [...groups.values()]
}

const STATUS_PRIORITY: Record<ProcessStatus, number> = {
  error: 0,
  starting: 1,
  running: 2,
  exited: 3,
}

export function worstStatus(teams: TeamProcess[]): ProcessStatus {
  let worst: ProcessStatus = 'exited'
  for (const team of teams) {
    if (STATUS_PRIORITY[team.status] < STATUS_PRIORITY[worst]) {
      worst = team.status
    }
  }
  return worst
}
