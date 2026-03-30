import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { z } from 'zod'
import { getRoomConfigPath } from './paths'

type RoomConfigFs = {
  existsSync(path: string): boolean
  mkdirSync(path: string, opts?: { recursive?: boolean }): void
  readFileSync(path: string, encoding: BufferEncoding): string
  writeFileSync(path: string, data: string, encoding?: BufferEncoding): void
}

const defaultFs: RoomConfigFs = {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
}

const roomConfigSchema = z.object({
  roomId: z.string(),
  usernames: z.array(z.string()).catch([]),
})

export type RoomConfig = z.infer<typeof roomConfigSchema>

interface RoomConfigOptions {
  /** Override the config path (for testing). */
  configPath?: string
  fs?: RoomConfigFs
}

function normalizeUsernames(usernames: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const username of usernames) {
    const normalized = username.trim()
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    result.push(normalized)
  }

  return result
}

function resolveConfigPath(roomId: string, options?: RoomConfigOptions): string {
  return options?.configPath ?? getRoomConfigPath(roomId)
}

export function readRoomConfig(
  roomId: string,
  options?: RoomConfigOptions,
): RoomConfig | null {
  const fs = options?.fs ?? defaultFs
  const configPath = resolveConfigPath(roomId, options)
  if (!fs.existsSync(configPath)) return null

  try {
    const raw = fs.readFileSync(configPath, 'utf-8')
    const parsed = roomConfigSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export function getRoomUsernames(
  roomId: string,
  options?: RoomConfigOptions,
): Set<string> {
  return new Set(readRoomConfig(roomId, options)?.usernames ?? [])
}

export function appendRoomUsernames(
  roomId: string,
  usernames: string[],
  options?: RoomConfigOptions,
): RoomConfig {
  const fs = options?.fs ?? defaultFs
  const configPath = resolveConfigPath(roomId, options)
  const existing = readRoomConfig(roomId, options)
  const merged = normalizeUsernames([...(existing?.usernames ?? []), ...usernames])
  const nextConfig: RoomConfig = { roomId, usernames: merged }

  try {
    fs.mkdirSync(dirname(configPath), { recursive: true })
    fs.writeFileSync(configPath, `${JSON.stringify(nextConfig, null, 2)}\n`)
  } catch (error) {
    // Local room config should not block listener startup or message handling,
    // but log a warning so degraded routing is visible.
    console.warn(
      `meet-ai: failed to write per-room config for ${roomId}: ${error instanceof Error ? error.message : String(error)}`
    )
  }
  return nextConfig
}
