import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { homeConfigSchema, homeConfigBaseSchema } from './config-schema'
import type { EnvConfig, HomeConfig } from './config-schema'

let meetAiDirOverride: string | undefined
const CONFIG_SCHEMA_URL = 'https://meet-ai.cc/schemas/config.json'

/** Override the home directory path (for testing). */
export function setMeetAiDirOverride(dir: string | undefined): void {
  meetAiDirOverride = dir
}

/** Returns the path to ~/.meet-ai (or override). */
export function getMeetAiDir(): string {
  return meetAiDirOverride ?? join(homedir(), '.meet-ai')
}

/** Returns the path to ~/.meet-ai/config.json. */
export function getConfigPath(): string {
  return join(getMeetAiDir(), 'config.json')
}

/** Returns the path to ~/.meet-ai/logs. */
export function getLogsDir(): string {
  return join(getMeetAiDir(), 'logs')
}

/** Creates ~/.meet-ai and ~/.meet-ai/logs if they don't exist. */
export function ensureHome(): void {
  mkdirSync(getMeetAiDir(), { recursive: true })
  mkdirSync(getLogsDir(), { recursive: true })
}

/** Reads and validates ~/.meet-ai/config.json. Returns null if missing or invalid. */
export function readHomeConfig(): HomeConfig | null {
  const configPath = getConfigPath()
  if (!existsSync(configPath)) return null

  try {
    const raw = JSON.parse(readFileSync(configPath, 'utf-8'))
    return homeConfigSchema.parse(raw)
  } catch {
    return null
  }
}

/**
 * Reads ~/.meet-ai/config.json without enforcing that defaultEnv is valid.
 * Returns a config even when defaultEnv points to a non-existent environment,
 * which is needed to detect and repair broken configs.
 */
export function readHomeConfigLoose(): HomeConfig | null {
  const configPath = getConfigPath()
  if (!existsSync(configPath)) return null

  try {
    const raw = JSON.parse(readFileSync(configPath, 'utf-8'))
    return homeConfigBaseSchema.parse(raw) as HomeConfig
  } catch {
    return null
  }
}

/** Writes config to ~/.meet-ai/config.json with mode 0o600. */
export function writeHomeConfig(config: HomeConfig): void {
  ensureHome()
  writeFileSync(
    getConfigPath(),
    `${JSON.stringify({ $schema: CONFIG_SCHEMA_URL, ...config }, null, 2)}\n`,
    { mode: 0o600 },
  )
}

/** Returns the { url, key } for the default environment. */
export function getDefaultEnv(config: HomeConfig): EnvConfig {
  return config.envs[config.defaultEnv]
}

/** Adds an environment. If it's the first one, sets it as default. */
export function addEnv(name: string, env: EnvConfig): void {
  const config = readHomeConfigLoose()

  if (!config) {
    writeHomeConfig({
      defaultEnv: name,
      envs: { [name]: env },
    })
    return
  }

  config.envs[name] = env
  if (Object.keys(config.envs).length === 1) {
    config.defaultEnv = name
  }
  writeHomeConfig(config)
}

/** Changes the default environment. Throws if the name doesn't exist. */
export function setDefaultEnv(name: string): void {
  const config = readHomeConfigLoose()
  if (!config) throw new Error('No config file found')
  if (!(name in config.envs)) throw new Error(`Environment "${name}" does not exist`)

  config.defaultEnv = name
  writeHomeConfig(config)
}

/** Returns { url, key } from the default environment, or null if unavailable. */
export function getHomeCredentials(): { url: string; key: string } | null {
  const config = readHomeConfig()
  if (!config) return null
  const env = getDefaultEnv(config)
  if (!env?.url || !env?.key) return null
  return { url: env.url, key: env.key }
}

/** Lists all environments with a flag indicating the default. */
export function listEnvs(): { name: string; isDefault: boolean }[] {
  const config = readHomeConfigLoose()
  if (!config) return []

  return Object.keys(config.envs).map(name => ({
    name,
    isDefault: name === config.defaultEnv,
  }))
}
