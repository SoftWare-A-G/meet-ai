import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

type SessionMeta = {
  id: string
  cwd?: string
  transcriptPath?: string
}

export interface CodexResolveOptions {
  codexHome?: string
  env?: NodeJS.ProcessEnv
  cwd?: string
}

function getCodexHome(options?: CodexResolveOptions): string {
  if (options?.codexHome) return options.codexHome
  if (options?.env?.CODEX_HOME) return options.env.CODEX_HOME
  if (process.env.CODEX_HOME) return process.env.CODEX_HOME
  if (process.env.MEET_AI_CODEX_STATE_DIR) return process.env.MEET_AI_CODEX_STATE_DIR
  return join(homedir(), '.codex')
}

export function getCodexConfigPaths(options?: CodexResolveOptions): string[] {
  const home = getCodexHome(options)
  return [
    resolve('.codex/config.json'),
    resolve('.codex/config.toml'),
    join(home, 'config.json'),
    join(home, 'config.toml'),
  ]
}

function parseCodexTomlEnv(path: string): Record<string, string> | null {
  if (!existsSync(path)) return null

  const env: Record<string, string> = {}
  let inEnvSection = false

  for (const line of readFileSync(path, 'utf-8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      inEnvSection = trimmed === '[env]'
      continue
    }

    if (!inEnvSection) continue

    const match = trimmed.match(/^([A-Z0-9_]+)\s*=\s*"([^"]*)"$/)
    if (!match) continue
    env[match[1]] = match[2]
  }

  return Object.keys(env).length > 0 ? env : null
}

export function readCodexConfigEnv(options?: CodexResolveOptions): Record<string, string> | null {
  for (const path of getCodexConfigPaths(options)) {
    if (!existsSync(path)) continue

    if (path.endsWith('.json')) {
      try {
        const parsed = JSON.parse(readFileSync(path, 'utf-8')) as {
          env?: Record<string, string>
        }
        if (parsed.env && Object.keys(parsed.env).length > 0) {
          return parsed.env
        }
      } catch {
        continue
      }
      continue
    }

    const env = parseCodexTomlEnv(path)
    if (env) return env
  }

  return null
}

export function extractCodexSessionMeta(transcriptPath: string): SessionMeta | null {
  try {
    const lines = readFileSync(transcriptPath, 'utf-8').split(/\r?\n/)
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const parsed = JSON.parse(line) as {
          type?: string
          payload?: { id?: string; cwd?: string }
        }
        if (parsed.type === 'session_meta' && parsed.payload?.id) {
          return {
            id: parsed.payload.id,
            cwd: parsed.payload.cwd,
            transcriptPath,
          }
        }
      } catch {
        continue
      }
    }
  } catch {
    return null
  }

  return null
}

function listTranscriptPaths(dir: string): string[] {
  if (!existsSync(dir)) return []

  const results: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...listTranscriptPaths(path))
      continue
    }
    if (entry.isFile() && path.endsWith('.jsonl')) {
      results.push(path)
    }
  }
  return results
}

export function readLatestCodexSessionId(options?: CodexResolveOptions): string | null {
  const indexPath = join(getCodexHome(options), 'session_index.jsonl')
  if (!existsSync(indexPath)) return null

  let latestId: string | null = null
  let latestTime = ''

  for (const line of readFileSync(indexPath, 'utf-8').split(/\r?\n/)) {
    if (!line.trim()) continue
    try {
      const parsed = JSON.parse(line) as { id?: string; updated_at?: string }
      if (!parsed.id || !parsed.updated_at) continue
      if (parsed.updated_at >= latestTime) {
        latestId = parsed.id
        latestTime = parsed.updated_at
      }
    } catch {
      continue
    }
  }

  return latestId
}

export function readCurrentCodexSessionId(options?: CodexResolveOptions): string | null {
  const cwd = options?.cwd ?? process.cwd()
  const sessionsDir = join(getCodexHome(options), 'sessions')

  let latestMatch: { id: string; mtimeMs: number } | null = null
  for (const transcriptPath of listTranscriptPaths(sessionsDir)) {
    const meta = extractCodexSessionMeta(transcriptPath)
    if (!meta?.id || meta.cwd !== cwd) continue

    let mtimeMs = 0
    try {
      mtimeMs = statSync(transcriptPath).mtimeMs
    } catch {
      mtimeMs = 0
    }

    if (!latestMatch || mtimeMs >= latestMatch.mtimeMs) {
      latestMatch = { id: meta.id, mtimeMs }
    }
  }

  if (latestMatch) return latestMatch.id
  return readLatestCodexSessionId(options)
}

export type CodexInboxEntry = {
  from: string
  text: string
  timestamp: string
  read: boolean
  attachments?: string[]
}

function getInboxPath(sessionId: string, options?: CodexResolveOptions): string {
  return join(getCodexHome(options), 'meet-ai', 'inbox', `${sessionId}.json`)
}

export function appendCodexInboxEntry(
  sessionId: string,
  entry: CodexInboxEntry,
  options?: CodexResolveOptions
): string {
  const path = getInboxPath(sessionId, options)
  mkdirSync(dirname(path), { recursive: true })

  let entries: CodexInboxEntry[] = []
  try {
    entries = JSON.parse(readFileSync(path, 'utf-8')) as CodexInboxEntry[]
  } catch {
    entries = []
  }

  entries.push(entry)
  writeFileSync(path, `${JSON.stringify(entries, null, 2)}\n`)
  return path
}
