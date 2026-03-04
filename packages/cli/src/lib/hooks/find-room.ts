import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { TeamSessionFile } from './types'

export function findRoomId(sessionId: string, teamsDir?: string): string | null {
  const dir = teamsDir ?? `${process.env.HOME}/.claude/teams`
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
      if (data.session_id === sessionId) {
        return data.room_id || null
      }
    } catch {
      continue
    }
  }

  return null
}
