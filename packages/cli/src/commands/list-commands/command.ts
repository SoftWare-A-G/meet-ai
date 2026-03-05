import { defineCommand } from 'citty'
import { listCommands } from './usecase'
import { err } from '../../lib/output'

export default defineCommand({
  meta: {
    name: 'list-commands',
    description: 'List all available Claude Code slash commands and skills as JSON',
  },
  args: {
    'project-path': {
      type: 'string',
      description: 'Path to the project root (defaults to cwd)',
    },
  },
  async run({ args }) {
    try {
      const commands = await listCommands({
        projectPath: args['project-path'],
      })
      console.log(JSON.stringify(commands, null, 2))
    } catch (error) {
      err(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  },
})
