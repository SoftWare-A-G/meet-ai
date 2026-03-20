import { join } from 'node:path'
import { homedir } from 'node:os'

export function getMeetAiTeamsDir(): string {
  return join(process.env.HOME ?? homedir(), '.meet-ai', 'teams')
}

export function getClaudeTeamsDir(): string {
  return join(process.env.HOME ?? homedir(), '.claude', 'teams')
}
