import { defineCommand } from 'citty'

export default defineCommand({
  meta: {
    name: 'hook',
    description: 'Claude Code hook subcommands',
  },
  subCommands: {
    'log-tool-use': () => import('./log-tool-use/command').then(m => m.default),
    'plan-review': () => import('./plan-review/command').then(m => m.default),
    'question-review': () => import('./question-review/command').then(m => m.default),
    'permission-review': () => import('./permission-review/command').then(m => m.default),
    'task-sync': () => import('./task-sync/command').then(m => m.default),
  },
})
