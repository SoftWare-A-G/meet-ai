import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export interface Credentials {
  url: string
  key: string
}

export function loadCredentials(): Credentials | null {
  try {
    const config = JSON.parse(readFileSync(join(homedir(), '.meet-ai', 'config.json'), 'utf-8'))
    const env = config.envs?.[config.defaultEnv]
    if (env?.url && env?.key) return { url: env.url, key: env.key }
    return null
  } catch {
    return null
  }
}
