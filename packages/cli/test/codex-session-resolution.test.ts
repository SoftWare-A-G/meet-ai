import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { readCurrentCodexSessionId } from '@meet-ai/cli/lib/codex'

const CODEX_HOME = '/tmp/meet-ai-codex-session-resolution'

function writeTranscript(relativePath: string, sessionId: string, cwd: string) {
  const path = join(CODEX_HOME, 'sessions', relativePath)
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(
    path,
    `${JSON.stringify({ type: 'session_meta', payload: { id: sessionId, cwd } })}\n`,
  )
  return path
}

describe('readCurrentCodexSessionId', () => {
  beforeEach(() => {
    rmSync(CODEX_HOME, { recursive: true, force: true })
    mkdirSync(join(CODEX_HOME, 'sessions'), { recursive: true })
  })

  afterEach(() => {
    rmSync(CODEX_HOME, { recursive: true, force: true })
  })

  test('prefers latest transcript matching cwd', () => {
    const older = writeTranscript('2026/03/08/older.jsonl', 'sess-old', '/repo/a')
    const newer = writeTranscript('2026/03/08/newer.jsonl', 'sess-new', '/repo/a')
    utimesSync(older, new Date('2026-03-08T10:00:00Z'), new Date('2026-03-08T10:00:00Z'))
    utimesSync(newer, new Date('2026-03-08T11:00:00Z'), new Date('2026-03-08T11:00:00Z'))

    expect(readCurrentCodexSessionId({ codexHome: CODEX_HOME, cwd: '/repo/a' })).toBe('sess-new')
  })

  test('falls back to session index when no cwd matches', () => {
    writeTranscript('2026/03/08/other.jsonl', 'sess-other', '/repo/other')
    writeFileSync(
      join(CODEX_HOME, 'session_index.jsonl'),
      `${JSON.stringify({ id: 'sess-index', updated_at: '2026-03-08T12:00:00Z' })}\n`,
    )

    expect(readCurrentCodexSessionId({ codexHome: CODEX_HOME, cwd: '/repo/a' })).toBe('sess-index')
  })
})
