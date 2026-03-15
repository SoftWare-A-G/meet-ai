import { readdirSync, readFileSync, writeFileSync, createReadStream } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
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
  teamsDir: string,
  teamDirName: string,
  sessionId: string,
): string | undefined {
  try {
    const configPath = join(teamsDir, teamDirName, 'config.json')
    const raw = readFileSync(configPath, 'utf-8')
    const config = JSON.parse(raw)
    if (config.leadSessionId === sessionId) {
      const leadMember = config.members?.find(
        (m: { agentId: string }) => m.agentId === config.leadAgentId,
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

export async function findRoom(
  sessionId: string,
  teamsDir?: string,
  transcriptPath?: string
): Promise<RoomLookupResult | null> {
  const dir = teamsDir ?? `${process.env.HOME}/.claude/teams`

  // Fast path: if we have a transcript, extract teamName and agentName
  if (transcriptPath) {
    const info = await extractTranscriptInfo(transcriptPath)
    if (info.teamName) {
      const filePath = join(dir, info.teamName, 'meet-ai.json')
      try {
        const raw = readFileSync(filePath, 'utf-8')
        const data: TeamSessionFile = JSON.parse(raw)
        // Auto-register this session if not already known
        registerSession(filePath, data, sessionId)
        if (data.room_id) {
          const teamName = data.team_name || info.teamName
          const agentName = info.agentName ?? resolveAgentNameFromConfig(dir, info.teamName, sessionId)
          return { roomId: data.room_id, teamName, agentName }
        }
      } catch {
        // meet-ai.json doesn't exist for this team
      }
    }
  }

  // Fallback: scan all teams (original behavior + session_ids support)
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return null
  }

  for (const entry of entries) {
    const filePath = join(dir, entry, 'meet-ai.json')
    try {
      const raw = readFileSync(filePath, 'utf-8')
      const data: TeamSessionFile = JSON.parse(raw)
      const knownIds = data.session_ids ?? [data.session_id]
      if (knownIds.includes(sessionId) || data.session_id === sessionId) {
        if (data.room_id) {
          const teamName = data.team_name || entry
          const agentName = resolveAgentNameFromConfig(dir, entry, sessionId)
          return { roomId: data.room_id, teamName, agentName }
        }
        return null
      }
    } catch {
      continue
    }
  }

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
