import { join } from 'node:path'
import { homedir } from 'node:os'

export function getMeetAiHomeDir(): string {
  return join(process.env.HOME ?? homedir(), '.meet-ai')
}

export function getMeetAiTeamsDir(): string {
  return join(getMeetAiHomeDir(), 'teams')
}

export function getClaudeTeamsDir(): string {
  return join(process.env.HOME ?? homedir(), '.claude', 'teams')
}

export function getMeetAiRoomsDir(): string {
  return join(getMeetAiHomeDir(), 'rooms')
}

export function getRoomConfigPath(roomId: string): string {
  return join(getMeetAiRoomsDir(), roomId, 'config.json')
}
