import { describe, expect, test } from 'bun:test'
import { getDashboardStartupState } from '@meet-ai/cli/commands/dashboard/onboarding'
import type { MigratableConfigSource } from '@meet-ai/cli/config'
import type { HomeConfig } from '@meet-ai/cli/lib/config-schema'

const migrationSource: MigratableConfigSource = {
  kind: 'user-claude',
  label: 'User Claude settings',
  path: '/tmp/.claude/settings.json',
  url: 'https://meet-ai.cc',
  key: 'mai_external_key',
  envName: 'meet-ai-cc',
}

describe('getDashboardStartupState', () => {
  test('returns ready when ~/.meet-ai config is valid', () => {
    const homeConfig = {
      defaultEnv: 'production',
      envs: {
        production: {
          url: 'https://meet-ai.cc',
          key: 'mai_home_key',
        },
      },
    } satisfies HomeConfig

    expect(getDashboardStartupState(homeConfig, homeConfig, true, [])).toEqual({
      mode: 'ready',
      config: { url: 'https://meet-ai.cc', key: 'mai_home_key' },
    })
  })

  test('returns env-selector when ~/.meet-ai has a broken default env', () => {
    const brokenHomeConfig = {
      defaultEnv: 'missing',
      envs: {
        production: {
          url: 'https://meet-ai.cc',
          key: 'mai_home_key',
        },
      },
    } satisfies HomeConfig

    expect(getDashboardStartupState(null, brokenHomeConfig, true, [])).toEqual({
      mode: 'env-selector',
    })
  })

  test('returns migrate when no home config exists and external credentials are available', () => {
    expect(getDashboardStartupState(null, null, false, [migrationSource])).toEqual({
      mode: 'migrate',
      sources: [migrationSource],
    })
  })

  test('returns auth when no home config or migration sources exist', () => {
    expect(getDashboardStartupState(null, null, false, [])).toEqual({
      mode: 'auth',
    })
  })

  test('returns auth when a config file exists but is unreadable and no repair source is available', () => {
    expect(getDashboardStartupState(null, null, true, [migrationSource])).toEqual({
      mode: 'auth',
    })
  })
})
