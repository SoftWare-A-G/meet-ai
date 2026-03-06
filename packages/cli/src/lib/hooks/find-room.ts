import { readdirSync, readFileSync, writeFileSync, createReadStream } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import type { TeamSessionFile } from './types'

/**
 * Extract teamName from a JSONL transcript file by reading lines until found.
 */
async function extractTeamName(transcriptPath: string): Promise<string | null> {
  try {
    const rl = createInterface({
      input: createReadStream(transcriptPath, 'utf-8'),
      crlfDelay: Infinity,
    })

    for await (const line of rl) {
      try {
        const obj = JSON.parse(line)
        if (obj.teamName) {
          rl.close()
          return obj.teamName
        }
      } catch {
        continue
      }
    }
  } catch {
    // File doesn't exist or isn't readable
  }
  return null
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
}

export async function findRoom(
  sessionId: string,
  teamsDir?: string,
  transcriptPath?: string
): Promise<RoomLookupResult | null> {
  const dir = teamsDir ?? `${process.env.HOME}/.claude/teams`

  // Fast path: if we have a transcript, extract teamName and look up directly
  if (transcriptPath) {
    const teamName = await extractTeamName(transcriptPath)
    if (teamName) {
      const filePath = join(dir, teamName, 'meet-ai.json')
      try {
        const raw = readFileSync(filePath, 'utf-8')
        const data: TeamSessionFile = JSON.parse(raw)
        // Auto-register this session if not already known
        registerSession(filePath, data, sessionId)
        if (data.room_id) return { roomId: data.room_id, teamName: data.team_name || teamName }
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
        if (data.room_id) return { roomId: data.room_id, teamName: data.team_name || entry }
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
