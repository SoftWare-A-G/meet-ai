import { test, expect, describe, beforeEach, afterEach, mock } from 'bun:test'
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { setMeetAiDirOverride, readHomeConfig } from '@meet-ai/cli/lib/meetai-home'
import {
  extractClaimToken,
  isDirectKey,
  resolveKeyInput,
  deriveEnvName,
  DEFAULT_URL,
} from '@meet-ai/cli/commands/dashboard/auth-helpers'

let tempDir: string

beforeEach(() => {
  tempDir = join(tmpdir(), `meetai-auth-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(tempDir, { recursive: true })
  setMeetAiDirOverride(tempDir)
})

afterEach(() => {
  setMeetAiDirOverride(undefined)
  rmSync(tempDir, { recursive: true, force: true })
})

describe('DEFAULT_URL', () => {
  test('defaults to https://meet-ai.cc', () => {
    expect(DEFAULT_URL).toBe('https://meet-ai.cc')
  })
})

describe('isDirectKey', () => {
  test('returns true for mai_ prefixed keys', () => {
    expect(isDirectKey('mai_abc123')).toBe(true)
  })

  test('returns true with whitespace around key', () => {
    expect(isDirectKey('  mai_abc123  ')).toBe(true)
  })

  test('returns false for non-mai_ strings', () => {
    expect(isDirectKey('sk_abc123')).toBe(false)
  })

  test('returns false for empty string', () => {
    expect(isDirectKey('')).toBe(false)
  })
})

describe('extractClaimToken', () => {
  test('extracts token from full URL', () => {
    expect(extractClaimToken('https://meet-ai.cc/auth/abc123')).toBe('abc123')
  })

  test('extracts token from bare path', () => {
    expect(extractClaimToken('/auth/abc123')).toBe('abc123')
  })

  test('extracts token with hyphens and underscores', () => {
    expect(extractClaimToken('https://example.com/auth/my-token_123')).toBe('my-token_123')
  })

  test('returns null for non-auth URLs', () => {
    expect(extractClaimToken('https://meet-ai.cc/dashboard')).toBeNull()
  })

  test('returns null for random text', () => {
    expect(extractClaimToken('hello world')).toBeNull()
  })

  test('returns null for empty string', () => {
    expect(extractClaimToken('')).toBeNull()
  })

  test('handles trailing whitespace', () => {
    expect(extractClaimToken('  https://meet-ai.cc/auth/token123  ')).toBe('token123')
  })
})

describe('deriveEnvName', () => {
  test('converts hostname dots to dashes', () => {
    expect(deriveEnvName('https://meet-ai.cc')).toBe('meet-ai-cc')
  })

  test('handles localhost', () => {
    expect(deriveEnvName('http://localhost:8787')).toBe('localhost')
  })

  test('returns "default" for invalid URLs', () => {
    expect(deriveEnvName('not a url')).toBe('default')
  })
})

describe('resolveKeyInput', () => {
  test('accepts direct mai_ key as-is', async () => {
    const key = await resolveKeyInput('https://meet-ai.cc', 'mai_testkey123')
    expect(key).toBe('mai_testkey123')
  })

  test('trims whitespace from direct key', async () => {
    const key = await resolveKeyInput('https://meet-ai.cc', '  mai_testkey123  ')
    expect(key).toBe('mai_testkey123')
  })

  test('rejects empty input', async () => {
    await expect(resolveKeyInput('https://meet-ai.cc', '')).rejects.toThrow(
      'Key or auth link is required',
    )
  })

  test('rejects whitespace-only input', async () => {
    await expect(resolveKeyInput('https://meet-ai.cc', '   ')).rejects.toThrow(
      'Key or auth link is required',
    )
  })

  test('rejects invalid input (not a key or auth link)', async () => {
    await expect(resolveKeyInput('https://meet-ai.cc', 'random-garbage')).rejects.toThrow(
      'Invalid input',
    )
  })

  test('claims auth token via fetch on auth link', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = mock(async () =>
      new Response(JSON.stringify({ api_key: 'mai_claimed_key' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch

    try {
      const key = await resolveKeyInput(
        'https://meet-ai.cc',
        'https://meet-ai.cc/auth/my-token',
      )
      expect(key).toBe('mai_claimed_key')
      expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('claims auth token from bare path', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = mock(async () =>
      new Response(JSON.stringify({ api_key: 'mai_from_path' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch

    try {
      const key = await resolveKeyInput('https://meet-ai.cc', '/auth/some-token')
      expect(key).toBe('mai_from_path')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('throws on claim failure (HTTP error)', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = mock(async () =>
      new Response('Not found', { status: 404 }),
    ) as unknown as typeof fetch

    try {
      await expect(
        resolveKeyInput('https://meet-ai.cc', '/auth/bad-token'),
      ).rejects.toThrow('Claim failed (404)')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('throws when claim response has no api_key', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = mock(async () =>
      new Response(JSON.stringify({ error: 'nope' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch

    try {
      await expect(
        resolveKeyInput('https://meet-ai.cc', '/auth/some-token'),
      ).rejects.toThrow('missing api_key')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

describe('addEnv integration via resolveKeyInput', () => {
  test('direct key can be persisted via addEnv', async () => {
    const { addEnv } = await import('@meet-ai/cli/lib/meetai-home')

    const key = await resolveKeyInput('https://meet-ai.cc', 'mai_persist_test')
    addEnv('test-env', { url: 'https://meet-ai.cc', key })

    const config = readHomeConfig()
    expect(config).not.toBeNull()
    expect(config!.defaultEnv).toBe('test-env')
    expect(config!.envs['test-env'].key).toBe('mai_persist_test')
  })
})
