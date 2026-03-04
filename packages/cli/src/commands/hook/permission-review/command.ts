import { defineCommand } from 'citty'
import { processPermissionReview } from './usecase'

export default defineCommand({
  meta: {
    name: 'permission-review',
    description: 'Handle Claude Code PermissionRequest hook — routes tool permission requests to meet-ai room for review',
  },
  async run() {
    try {
      let input = ''
      for await (const chunk of process.stdin) {
        input += chunk
      }
      await processPermissionReview(input)
    } catch (error) {
      process.stderr.write(`[permission-review] fatal: ${error}\n`)
    }
    // Always exit 0 — hook must never block the agent
    process.exit(0)
  },
})
