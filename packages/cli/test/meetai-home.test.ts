import { test, expect, describe, beforeEach, afterEach } from 'bun:test'
import { mkdirSync, rmSync, writeFileSync, existsSync, statSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  getMeetAiDir,
  getConfigPath,
  getLogsDir,
  ensureHome,
  readHomeConfig,
  readHomeConfigLoose,
  writeHomeConfig,
  getDefaultEnv,
  addEnv,
  setDefaultEnv,
  listEnvs,
  setMeetAiDirOverride,
} from '@meet-ai/cli/lib/meetai-home'
import type { HomeConfig } from '@meet-ai/cli/lib/config-schema'

let tempDir: string

beforeEach(() => {
  tempDir = join(tmpdir(), `meetai-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(tempDir, { recursive: true })
  setMeetAiDirOverride(tempDir)
})

afterEach(() => {
  setMeetAiDirOverride(undefined)
  rmSync(tempDir, { recursive: true, force: true })
})

describe('path helpers', () => {
  test('getMeetAiDir returns override', () => {
    expect(getMeetAiDir()).toBe(tempDir)
  })

  test('getConfigPath returns config.json inside home dir', () => {
    expect(getConfigPath()).toBe(join(tempDir, 'config.json'))
  })

  test('getLogsDir returns logs inside home dir', () => {
    expect(getLogsDir()).toBe(join(tempDir, 'logs'))
  })
})

describe('ensureHome', () => {
  test('creates home dir and logs dir', () => {
    const subDir = join(tempDir, 'sub')
    setMeetAiDirOverride(subDir)

    ensureHome()

    expect(existsSync(subDir)).toBe(true)
    expect(existsSync(join(subDir, 'logs'))).toBe(true)
  })
})

describe('readHomeConfig / writeHomeConfig', () => {
  test('returns null when config file is missing', () => {
    expect(readHomeConfig()).toBeNull()
  })

  test('returns null for corrupt JSON', () => {
    writeFileSync(join(tempDir, 'config.json'), 'not valid json')
    expect(readHomeConfig()).toBeNull()
  })

  test('returns null for invalid schema', () => {
    writeFileSync(join(tempDir, 'config.json'), JSON.stringify({ bad: true }))
    expect(readHomeConfig()).toBeNull()
  })

  test('round-trips a valid config', () => {
    const config: HomeConfig = {
      defaultEnv: 'prod',
      envs: {
        prod: { url: 'https://meet-ai.cc', key: 'mai_prod_123' },
      },
    }

    writeHomeConfig(config)
    const read = readHomeConfig()
    const raw = JSON.parse(readFileSync(join(tempDir, 'config.json'), 'utf-8'))

    expect(read).toEqual({
      $schema: 'https://meet-ai.cc/schemas/config.json',
      ...config,
    })
    expect(raw.$schema).toBe('https://meet-ai.cc/schemas/config.json')
    expect(Object.keys(raw)[0]).toBe('$schema')
  })

  test('writeHomeConfig creates parent dirs', () => {
    const nested = join(tempDir, 'deep', 'nested')
    setMeetAiDirOverride(nested)

    const config: HomeConfig = {
      defaultEnv: 'test',
      envs: {
        test: { url: 'https://test.example.com', key: 'mai_test_abc' },
      },
    }

    writeHomeConfig(config)
    expect(existsSync(join(nested, 'config.json'))).toBe(true)
    const raw = JSON.parse(readFileSync(join(nested, 'config.json'), 'utf-8'))
    expect(raw.$schema).toBe('https://meet-ai.cc/schemas/config.json')
    expect(Object.keys(raw)[0]).toBe('$schema')
  })

  test('writeHomeConfig sets restrictive file permissions', () => {
    const config: HomeConfig = {
      defaultEnv: 'prod',
      envs: {
        prod: { url: 'https://meet-ai.cc', key: 'mai_prod_123' },
      },
    }

    writeHomeConfig(config)
    const stat = statSync(join(tempDir, 'config.json'))
    // 0o600 = owner read+write only (decimal 384)
    expect(stat.mode & 0o777).toBe(0o600)
  })
})

describe('getDefaultEnv', () => {
  test('returns the env matching defaultEnv', () => {
    const config: HomeConfig = {
      defaultEnv: 'staging',
      envs: {
        prod: { url: 'https://meet-ai.cc', key: 'mai_prod_123' },
        staging: { url: 'https://staging.meet-ai.cc', key: 'mai_staging_456' },
      },
    }

    const env = getDefaultEnv(config)
    expect(env.url).toBe('https://staging.meet-ai.cc')
    expect(env.key).toBe('mai_staging_456')
  })
})

describe('addEnv', () => {
  test('first env becomes default', () => {
    addEnv('prod', { url: 'https://meet-ai.cc', key: 'mai_prod_123' })

    const config = readHomeConfig()
    expect(config).not.toBeNull()
    expect(config!.defaultEnv).toBe('prod')
    expect(config!.envs.prod.url).toBe('https://meet-ai.cc')
  })

  test('second env does not change default', () => {
    addEnv('prod', { url: 'https://meet-ai.cc', key: 'mai_prod_123' })
    addEnv('staging', { url: 'https://staging.meet-ai.cc', key: 'mai_staging_456' })

    const config = readHomeConfig()
    expect(config!.defaultEnv).toBe('prod')
    expect(Object.keys(config!.envs)).toHaveLength(2)
  })

  test('overwrites existing env with same name', () => {
    addEnv('prod', { url: 'https://meet-ai.cc', key: 'mai_prod_123' })
    addEnv('prod', { url: 'https://new.meet-ai.cc', key: 'mai_new_456' })

    const config = readHomeConfig()
    expect(config!.envs.prod.url).toBe('https://new.meet-ai.cc')
  })
})

describe('setDefaultEnv', () => {
  test('changes the default environment', () => {
    addEnv('prod', { url: 'https://meet-ai.cc', key: 'mai_prod_123' })
    addEnv('staging', { url: 'https://staging.meet-ai.cc', key: 'mai_staging_456' })

    setDefaultEnv('staging')

    const config = readHomeConfig()
    expect(config!.defaultEnv).toBe('staging')
  })

  test('throws when no config file exists', () => {
    expect(() => setDefaultEnv('prod')).toThrow('No config file found')
  })

  test('throws when env does not exist', () => {
    addEnv('prod', { url: 'https://meet-ai.cc', key: 'mai_prod_123' })
    expect(() => setDefaultEnv('nonexistent')).toThrow('does not exist')
  })

  test('repairs a config with broken defaultEnv using an existing env', () => {
    writeFileSync(
      join(tempDir, 'config.json'),
      JSON.stringify({
        defaultEnv: 'missing',
        envs: {
          prod: { url: 'https://meet-ai.cc', key: 'mai_prod_123' },
          staging: { url: 'https://staging.meet-ai.cc', key: 'mai_staging_456' },
        },
      }),
    )

    expect(readHomeConfig()).toBeNull()
    expect(readHomeConfigLoose()!.defaultEnv).toBe('missing')

    setDefaultEnv('staging')

    const config = readHomeConfig()
    expect(config).not.toBeNull()
    expect(config!.defaultEnv).toBe('staging')
    expect(config!.envs.staging.key).toBe('mai_staging_456')
  })
})

describe('listEnvs', () => {
  test('returns empty array when no config', () => {
    expect(listEnvs()).toEqual([])
  })

  test('returns envs with default flag', () => {
    addEnv('prod', { url: 'https://meet-ai.cc', key: 'mai_prod_123' })
    addEnv('staging', { url: 'https://staging.meet-ai.cc', key: 'mai_staging_456' })

    const envs = listEnvs()
    expect(envs).toHaveLength(2)

    const prod = envs.find(e => e.name === 'prod')
    const staging = envs.find(e => e.name === 'staging')
    expect(prod!.isDefault).toBe(true)
    expect(staging!.isDefault).toBe(false)
  })

  test('reflects changed default', () => {
    addEnv('prod', { url: 'https://meet-ai.cc', key: 'mai_prod_123' })
    addEnv('staging', { url: 'https://staging.meet-ai.cc', key: 'mai_staging_456' })
    setDefaultEnv('staging')

    const envs = listEnvs()
    const prod = envs.find(e => e.name === 'prod')
    const staging = envs.find(e => e.name === 'staging')
    expect(prod!.isDefault).toBe(false)
    expect(staging!.isDefault).toBe(true)
  })

  test('lists environments from a config with broken defaultEnv', () => {
    writeFileSync(
      join(tempDir, 'config.json'),
      JSON.stringify({
        defaultEnv: 'missing',
        envs: {
          prod: { url: 'https://meet-ai.cc', key: 'mai_prod_123' },
          staging: { url: 'https://staging.meet-ai.cc', key: 'mai_staging_456' },
        },
      }),
    )

    const envs = listEnvs()
    expect(envs).toHaveLength(2)
    expect(envs.map(env => env.name).sort()).toEqual(['prod', 'staging'])
    expect(envs.every(env => env.isDefault === false)).toBe(true)
  })
})
