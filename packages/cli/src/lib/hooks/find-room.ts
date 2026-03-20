import { readdirSync, readFileSync, writeFileSync, mkdirSync, createReadStream } from 'node:fs'
import { join, dirname } from 'node:path'
import { createInterface } from 'node:readline'
import { getMeetAiTeamsDir, getClaudeTeamsDir } from '../paths'
import type { TeamSessionFile } from './types'

type TranscriptInfo = {
  teamName: string | null
  agentName: string | null
}

/**
 * Extract teamName and agentName from a JSONL transcript file.
 * Both fields appear on the first entry for teammates; the lead has neither.
 */
async function extractTranscriptInfo(transcriptPath: string): Promise<TranscriptInfo> {
  const result: TranscriptInfo = { teamName: null, agentName: null }
  try {
    const rl = createInterface({
      input: createReadStream(transcriptPath, 'utf-8'),
      crlfDelay: Infinity,
    })

    for await (const line of rl) {
      try {
        const obj = JSON.parse(line)
        if (obj.teamName && !result.teamName) result.teamName = obj.teamName
        if (obj.agentName && !result.agentName) result.agentName = obj.agentName
        if (result.teamName) {
          rl.close()
          return result
        }
      } catch {
        continue
      }
    }
  } catch {
    // File doesn't exist or isn't readable
  }
  return result
}

/**
 * Resolve agent name from team config.json when transcript doesn't have it (e.g. team lead).
 */
function resolveAgentNameFromConfig(
  claudeTeamsDir: string,
  teamDirName: string,
  sessionId: string
): string | undefined {
  try {
    const configPath = join(claudeTeamsDir, teamDirName, 'config.json')
    const raw = readFileSync(configPath, 'utf-8')
    const config = JSON.parse(raw)
    if (config.leadSessionId === sessionId) {
      const leadMember = config.members?.find(
        (m: { agentId: string }) => m.agentId === config.leadAgentId
      )
      return leadMember?.name ?? 'team-lead'
    }
  } catch {
    // Config doesn't exist or can't be read
  }
  return undefined
}

/**
 * Register a session ID in the team's meet-ai.json session_ids array.
 */
function registerSession(filePath: string, data: TeamSessionFile, sessionId: string): void {
  const ids = data.session_ids ?? [data.session_id]
  if (!ids.includes(sessionId)) {
    ids.push(sessionId)
  }
  if (!ids.includes(data.session_id)) {
    ids.unshift(data.session_id)
  }
  data.session_ids = ids
  try {
    mkdirSync(dirname(filePath), { recursive: true })
    writeFileSync(filePath, JSON.stringify(data))
  } catch {
    // Can't write — silently ignore
  }
}

export type RoomLookupResult = {
  roomId: string
  teamName: string
  agentName?: string
}

/**
 * Scan a single directory for meet-ai.json files matching the given session.
 * Uses `claudeTeamsDir` for config.json lookups (always ~/.claude/teams).
 *
 * Returns:
 * - `RoomLookupResult` — found a matching session with a room_id
 * - `null` — directory exists but no matching session (or match has no room_id)
 * - `undefined` — directory doesn't exist; caller should try the next directory
 */
function scanDir(
  searchDir: string,
  claudeTeamsDir: string,
  sessionId: string,
  transcriptInfo?: TranscriptInfo
): RoomLookupResult | null | undefined {
  // Fast path: if transcript gave us a team name, check that team directly
  if (transcriptInfo?.teamName) {
    const filePath = join(searchDir, transcriptInfo.teamName, 'meet-ai.json')
    try {
      const raw = readFileSync(filePath, 'utf-8')
      const data: TeamSessionFile = JSON.parse(raw)
      registerSession(filePath, data, sessionId)
      if (data.room_id) {
        const teamName = data.team_name || transcriptInfo.teamName
        const agentName =
          transcriptInfo.agentName ??
          resolveAgentNameFromConfig(claudeTeamsDir, transcriptInfo.teamName, sessionId)
        return { roomId: data.room_id, teamName, agentName }
      }
    } catch {
      // meet-ai.json doesn't exist for this team in this dir
    }
  }

  // Full scan
  let entries: string[]
  try {
    entries = readdirSync(searchDir)
  } catch {
    return undefined // directory doesn't exist — signal caller to try next
  }

  for (const entry of entries) {
    const filePath = join(searchDir, entry, 'meet-ai.json')
    try {
      const raw = readFileSync(filePath, 'utf-8')
      const data: TeamSessionFile = JSON.parse(raw)
      const knownIds = data.session_ids ?? [data.session_id]
      if (knownIds.includes(sessionId) || data.session_id === sessionId) {
        if (data.room_id) {
          const teamName = data.team_name || entry
          const agentName = resolveAgentNameFromConfig(claudeTeamsDir, entry, sessionId)
          return { roomId: data.room_id, teamName, agentName }
        }
        return null
      }
    } catch {
      continue
    }
  }

  return undefined // nothing found in this dir
}

export async function findRoom(
  sessionId: string,
  teamsDir?: string,
  transcriptPath?: string
): Promise<RoomLookupResult | null> {
  const claudeTeamsDir = getClaudeTeamsDir()
  const info = transcriptPath ? await extractTranscriptInfo(transcriptPath) : undefined

  if (teamsDir) {
    // Explicit override — use the custom dir for everything (tests, custom setups)
    const result = scanDir(teamsDir, teamsDir, sessionId, info)
    return result ?? null
  }

  // Default: meet-ai.json in ~/.meet-ai/teams, config.json in ~/.claude/teams
  const primaryDir = getMeetAiTeamsDir()
  const result = scanDir(primaryDir, claudeTeamsDir, sessionId, info)
  if (result !== undefined) return result

  // Backward compat: also scan ~/.claude/teams for meet-ai.json
  const fallback = scanDir(claudeTeamsDir, claudeTeamsDir, sessionId, info)
  if (fallback !== undefined) return fallback

  return null
}

export async function findRoomId(
  sessionId: string,
  teamsDir?: string,
  transcriptPath?: string
): Promise<string | null> {
  const result = await findRoom(sessionId, teamsDir, transcriptPath)
  return result?.roomId ?? null
}
