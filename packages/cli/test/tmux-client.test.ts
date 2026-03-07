import { describe, test, expect } from 'bun:test'
import { parseVersion, TmuxClient } from '@meet-ai/cli/lib/tmux-client'

describe('parseVersion', () => {
  test('parses standard version string', () => {
    expect(parseVersion('tmux 3.4')).toEqual([3, 4])
  })

  test('parses version with extra text', () => {
    expect(parseVersion('tmux 3.2a')).toEqual([3, 2])
  })

  test('returns [0, 0] for null', () => {
    expect(parseVersion(null)).toEqual([0, 0])
  })

  test('returns [0, 0] for garbage', () => {
    expect(parseVersion('not a version')).toEqual([0, 0])
  })

  test('parses higher versions', () => {
    expect(parseVersion('tmux 4.0')).toEqual([4, 0])
  })
})

describe('TmuxClient', () => {
  test('checkAvailability returns version info', () => {
    const client = new TmuxClient({ server: 'test-meet-ai', scrollback: 100 })
    const result = client.checkAvailability()
    // tmux may or may not be installed in CI — test that the method runs
    expect(typeof result.available).toBe('boolean')
    if (result.available) {
      expect(result.version).toBeTruthy()
    }
  })

  test('session name validation rejects special characters', () => {
    const client = new TmuxClient({ server: 'test-meet-ai', scrollback: 100 })
    expect(() => client.killSession('session;rm -rf /')).toThrow('Invalid tmux session name')
    expect(() => client.killSession('session$(whoami)')).toThrow('Invalid tmux session name')
    expect(() => client.killSession('')).toThrow('Invalid tmux session name')
  })

  test('session name validation accepts valid names', () => {
    const client = new TmuxClient({ server: 'test-meet-ai', scrollback: 100 })
    // These should not throw (session may not exist — we only test name validation)
    expect(() => client.killSession('mai-abc-123')).not.toThrow()
    expect(() => client.killSession('test_session')).not.toThrow()
    expect(() => client.killSession('my-session-name')).not.toThrow()
  })

  test('listSessions returns empty array when no server running', () => {
    const client = new TmuxClient({ server: 'nonexistent-test-server-xyz', scrollback: 100 })
    const sessions = client.listSessions()
    expect(sessions).toEqual([])
  })
})
