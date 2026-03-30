import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { readRoomConfig, appendRoomUsernames, getRoomUsernames } from './room-config'

describe('room-config', () => {
  const tempDir = '/tmp/meet-ai-room-config-test'

  function configPathFor(roomId: string): string {
    return join(tempDir, 'rooms', roomId, 'config.json')
  }

  beforeEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
    mkdirSync(tempDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('creates a per-room config file with deduplicated usernames', () => {
    const config = appendRoomUsernames(
      'room-123',
      ['codex', 'team-lead', 'codex', '  ', 'isnifer-pwa'],
      { configPath: configPathFor('room-123') },
    )

    expect(config).toEqual({
      roomId: 'room-123',
      usernames: ['codex', 'team-lead', 'isnifer-pwa'],
    })
    expect(readRoomConfig('room-123', { configPath: configPathFor('room-123') })).toEqual(config)
  })

  it('merges new usernames into an existing room config', () => {
    appendRoomUsernames('room-123', ['codex', 'team-lead'], { configPath: configPathFor('room-123') })

    const next = appendRoomUsernames(
      'room-123',
      ['claude-code', 'codex'],
      { configPath: configPathFor('room-123') },
    )

    expect(next.usernames).toEqual(['codex', 'team-lead', 'claude-code'])
    expect(getRoomUsernames('room-123', { configPath: configPathFor('room-123') })).toEqual(
      new Set(['codex', 'team-lead', 'claude-code']),
    )
  })

  it('falls back to an empty usernames list for malformed usernames data', () => {
    const dir = join(tempDir, 'rooms', 'room-123')
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      join(dir, 'config.json'),
      '{"roomId":"room-123","usernames":"nope"}',
    )

    expect(readRoomConfig('room-123', { configPath: configPathFor('room-123') })).toEqual({
      roomId: 'room-123',
      usernames: [],
    })
    expect(getRoomUsernames('room-123', { configPath: configPathFor('room-123') })).toEqual(new Set())
  })
})
