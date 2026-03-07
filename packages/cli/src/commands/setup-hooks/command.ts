import { defineCommand } from 'citty'
import { setupHooks } from './usecase'
import { err } from '@meet-ai/cli/lib/output'

export default defineCommand({
  meta: {
    name: 'setup-hooks',
    description: 'Configure Claude Code hooks for meet-ai in ~/.claude/settings.json',
  },
  args: {
    project: {
      type: 'boolean',
      description: 'Write to ./.claude/settings.json instead of ~/.claude/settings.json',
      default: false,
    },
    'dry-run': {
      type: 'boolean',
      description: 'Print what would be written without actually writing',
      default: false,
    },
    remove: {
      type: 'boolean',
      description: 'Remove meet-ai hooks from settings instead of adding them',
      default: false,
    },
  },
  async run({ args }) {
    try {
      await setupHooks({
        project: args.project,
        dryRun: args['dry-run'],
        remove: args.remove,
      })
    } catch (error) {
      err(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  },
})
