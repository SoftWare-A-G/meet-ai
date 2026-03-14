#!/usr/bin/env node
import { defineCommand, runMain } from 'citty'
import { version } from '../package.json'
import { err } from './lib/output.js'

const main = defineCommand({
  meta: {
    name: 'meet-ai',
    version,
    description:
      'CLI for meet-ai chat rooms — create rooms, send messages, and stream via WebSocket',
  },
  args: {
    debug: {
      type: 'boolean',
      description: 'Show debug output in panes (spawn commands, raw chunks, exit codes)',
      default: false,
    },
  },
  subCommands: {
    'create-room': () => import('./commands/create-room/command').then(m => m.default),
    'delete-room': () => import('./commands/delete-room/command').then(m => m.default),
    'send-message': () => import('./commands/send-message/command').then(m => m.default),
    'send-log': () => import('./commands/send-log/command').then(m => m.default),
    poll: () => import('./commands/poll/command').then(m => m.default),
    listen: () => import('./commands/listen/command').then(m => m.default),
    canvas: () => import('./commands/canvas/command').then(m => m.default),
    'send-team-info': () => import('./commands/send-team-info/command').then(m => m.default),
    'send-tasks': () => import('./commands/send-tasks/command').then(m => m.default),
    'download-attachment': () =>
      import('./commands/download-attachment/command').then(m => m.default),
    'generate-key': () => import('./commands/generate-key/command').then(m => m.default),
    hook: () => import('./commands/hook/command').then(m => m.default),
    'setup-hooks': () => import('./commands/setup-hooks/command').then(m => m.default),
    'list-commands': () => import('./commands/list-commands/command').then(m => m.default),
    'send-commands': () => import('./commands/send-commands/command').then(m => m.default),
  },
  async run({ args }) {
    // Only spawn interactive mode when no subcommand was given
    const hasSubcommand = process.argv.length > 2
    if (hasSubcommand) return

    // No subcommand given — launch the TUI dashboard as default
    try {
      if (!process.stdin.isTTY) {
        throw new Error(
          'Bare "meet-ai" requires an interactive terminal. Run it in a real terminal to open the dashboard or sign-in flow.',
        )
      }

      const { getClient } = await import('./domain/bootstrap.js')
      const { startDashboard } = await import('./commands/dashboard/usecase.js')
      const { detectDashboardStartupState, runOnboardingForState } = await import('./commands/dashboard/onboarding')

      const startupState = detectDashboardStartupState()
      let config = startupState.mode === 'ready'
        ? startupState.config
        : await runOnboardingForState(startupState)

      if (!config) {
        process.exit(0)
      }

      if (!config.key) {
        throw new Error('Meet AI home config is missing a valid API key.')
      }

      if (!config.url) {
        throw new Error('Meet AI home config is missing a valid URL.')
      }

      const client = getClient(config)
      await startDashboard(client, config, { debug: args.debug })
    } catch (error) {
      err(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  },
})

runMain(main)
