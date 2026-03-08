import { defineCommand } from 'citty'
import { processTaskSync } from './usecase'

export default defineCommand({
  meta: {
    name: 'task-sync',
    description: 'Hook: sync Claude task events to the kanban board',
  },
  async run() {
    try {
      let input = ''
      for await (const chunk of process.stdin) {
        input += chunk
      }
      await processTaskSync(input)
    } catch {
      // Never crash — hooks must always exit 0
    }
    process.exit(0)
  },
})
