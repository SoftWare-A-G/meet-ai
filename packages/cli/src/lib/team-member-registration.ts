import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHookClient, getTeamInfo, sendTeamMemberUpsert } from './hooks/client'
import { getHomeCredentials } from './meetai-home'
import { getMeetAiTeamsDir, getClaudeTeamsDir } from './paths'

type TeamConfigMember = {
  agentId?: string
  name?: string
  agentType?: string
  model?: string
  joinedAt?: number
  color?: string
}

type TeamConfig = {
  leadAgentId?: string
  members?: TeamConfigMember[]
}

export type TeamMemberRegistrar = (input: {
  roomId: string
  agentName?: string
  teamName?: string
  color?: string
  role?: string
  model?: string
  joinedAt?: number
}) => Promise<void>

function readJsonFile<T>(filePath: string): T | null {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as T
  } catch {
    return null
  }
}

function scanTeamsDirForRoom(dir: string, roomId: string): string | null {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return null
  }

  for (const entry of entries) {
    const roomBinding = readJsonFile<{ room_id?: string; team_name?: string }>(
      join(dir, entry, 'meet-ai.json')
    )
    if (roomBinding?.room_id === roomId) {
      return roomBinding.team_name || entry
    }
  }

  return null
}

function findTeamNameByRoomId(roomId: string): string | null {
  return scanTeamsDirForRoom(getMeetAiTeamsDir(), roomId)
    ?? scanTeamsDirForRoom(getClaudeTeamsDir(), roomId)
}

function readTeamConfig(teamName: string): TeamConfig | null {
  return readJsonFile<TeamConfig>(join(getClaudeTeamsDir(), teamName, 'config.json'))
}

function resolveLeadAgentName(config: TeamConfig | null): string | undefined {
  if (!config) return undefined
  const explicitLead = config.leadAgentId?.split('@')[0]?.trim()
  if (explicitLead) return explicitLead
  return config.members?.[0]?.name?.trim() || undefined
}

function findConfigMember(
  config: TeamConfig | null,
  agentName: string | undefined
): TeamConfigMember | undefined {
  if (!config || !agentName) return undefined

  return config.members?.find(member => {
    if (member.name?.trim() === agentName) return true
    return member.agentId?.startsWith(`${agentName}@`) ?? false
  })
}

function defaultColor(agentName: string, role: string): string {
  if (agentName === 'codex' || role === 'codex') return '#22c55e'
  if (role === 'team-lead') return '#3b82f6'
  return '#818cf8'
}

export const registerActiveTeamMember: TeamMemberRegistrar = async input => {
  const creds = getHomeCredentials()
  if (!creds) return
  const { url, key } = creds

  const client = createHookClient(url, key)
  const roomTeamInfo = await getTeamInfo(client, input.roomId)
  const resolvedTeamName =
    input.teamName?.trim() ||
    findTeamNameByRoomId(input.roomId) ||
    roomTeamInfo?.team_name?.trim() ||
    undefined
  const config = resolvedTeamName ? readTeamConfig(resolvedTeamName) : null
  const resolvedAgentName =
    input.agentName?.trim() ||
    process.env.MEET_AI_AGENT_NAME?.trim() ||
    resolveLeadAgentName(config)

  if (!resolvedAgentName) return

  const member = findConfigMember(config, resolvedAgentName)
  const teamName = resolvedTeamName || resolvedAgentName
  const role = input.role || member?.agentType || 'agent'
  const existingRoomMember = roomTeamInfo?.members?.find(existing => {
    if (existing.name?.trim() !== resolvedAgentName) return false
    return !input.role || existing.role === role
  })
  const model = input.model || member?.model || 'unknown'
  const joinedAt = input.joinedAt ?? member?.joinedAt ?? Date.now()
  const color =
    input.color ||
    member?.color ||
    process.env.MEET_AI_COLOR?.trim() ||
    defaultColor(resolvedAgentName, role)
  const teammateId = existingRoomMember?.teammate_id || member?.agentId || `${resolvedAgentName}@${teamName}`
  await sendTeamMemberUpsert(client, input.roomId, teamName, {
    teammate_id: teammateId,
    name: resolvedAgentName,
    color,
    role,
    model,
    status: 'active',
    joinedAt,
  })
}
