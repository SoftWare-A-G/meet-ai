import { existsSync } from 'node:fs'
import React from 'react'
import { render } from 'ink'
import { findMigratableConfigSources } from '@meet-ai/cli/config'
import { getConfigPath, getDefaultEnv, readHomeConfig, readHomeConfigLoose } from '@meet-ai/cli/lib/meetai-home'
import { AuthModal } from './AuthModal'
import { EnvSelectorModal } from './EnvSelectorModal'
import { MigrationModal } from './MigrationModal'
import type { MeetAiConfig, MigratableConfigSource } from '@meet-ai/cli/config'
import type { HomeConfig } from '@meet-ai/cli/lib/config-schema'

export type DashboardStartupState =
  | { mode: 'ready'; config: MeetAiConfig }
  | { mode: 'env-selector' }
  | { mode: 'migrate'; sources: MigratableConfigSource[] }
  | { mode: 'auth' }

export function getDashboardStartupState(
  homeConfig: HomeConfig | null,
  homeConfigLoose: HomeConfig | null,
  hasHomeConfigFile: boolean,
  migrationSources: MigratableConfigSource[],
): DashboardStartupState {
  if (homeConfig) {
    const env = getDefaultEnv(homeConfig)
    return {
      mode: 'ready',
      config: { url: env.url, key: env.key },
    }
  }

  const hasBrokenDefaultEnv = Boolean(
    homeConfigLoose &&
      Object.keys(homeConfigLoose.envs).length > 0 &&
      !(homeConfigLoose.defaultEnv in homeConfigLoose.envs),
  )
  if (hasBrokenDefaultEnv) {
    return { mode: 'env-selector' }
  }

  if (!hasHomeConfigFile && migrationSources.length > 0) {
    return { mode: 'migrate', sources: migrationSources }
  }

  return { mode: 'auth' }
}

export function detectDashboardStartupState(): DashboardStartupState {
  const homeConfig = readHomeConfig()
  const homeConfigLoose = readHomeConfigLoose()
  const hasHomeConfigFile = existsSync(getConfigPath())
  const migrationSources = hasHomeConfigFile ? [] : findMigratableConfigSources()

  return getDashboardStartupState(
    homeConfig,
    homeConfigLoose,
    hasHomeConfigFile,
    migrationSources,
  )
}

export async function runOnboardingForState(
  state: Exclude<DashboardStartupState, { mode: 'ready' }>,
): Promise<MeetAiConfig | null> {
  if (state.mode === 'env-selector') {
    return showEnvSelector()
  }

  if (state.mode === 'migrate') {
    return showMigrationModal(state.sources)
  }

  return showAuthModal()
}

function showAuthModal(): Promise<MeetAiConfig | null> {
  return new Promise<MeetAiConfig | null>(resolve => {
    const instance = render(
      React.createElement(AuthModal, {
        onSuccess: (config: MeetAiConfig) => {
          instance.unmount()
          resolve(config)
        },
        onCancel: () => {
          instance.unmount()
          resolve(null)
        },
      }),
    )
  })
}

function showMigrationModal(
  sources: MigratableConfigSource[],
): Promise<MeetAiConfig | null> {
  return new Promise<MeetAiConfig | null>(resolve => {
    const instance = render(
      React.createElement(MigrationModal, {
        sources,
        onSuccess: (config: MeetAiConfig) => {
          instance.unmount()
          resolve(config)
        },
        onCancel: () => {
          instance.unmount()
          resolve(null)
        },
        onManualSignIn: () => {
          instance.unmount()
          void showAuthModal().then(resolve)
        },
      }),
    )
  })
}

export function showEnvSelector(): Promise<MeetAiConfig | null> {
  return new Promise<MeetAiConfig | null>(resolve => {
    const instance = render(
      React.createElement(EnvSelectorModal, {
        onSuccess: (config: MeetAiConfig) => {
          instance.unmount()
          resolve(config)
        },
        onCancel: () => {
          instance.unmount()
          resolve(null)
        },
      }),
    )
  })
}
