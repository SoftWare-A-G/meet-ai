import { defineCommand } from 'citty'
import { processHookInput } from './usecase'

export default defineCommand({
  meta: {
    name: 'log-tool-use',
    description: 'Hook: log tool use events to a chat room',
  },
  async run() {
    try {
      let input = ''
      for await (const chunk of process.stdin) {
        input += chunk
      }
      await processHookInput(input)
    } catch {
      // Never crash — hooks must always exit 0
    }
    process.exit(0)
  },
})
