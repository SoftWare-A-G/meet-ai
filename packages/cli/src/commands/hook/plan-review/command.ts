import { defineCommand } from 'citty'

export default defineCommand({
  meta: {
    name: 'plan-review',
    description: 'Claude Code hook: send plan for review and poll for decision',
  },
  async run() {
    try {
      let input = ''
      for await (const chunk of process.stdin) {
        input += chunk
      }

      const { processPlanReview } = await import('./usecase')
      await processPlanReview(input)
    } catch (error) {
      process.stderr.write(`[plan-review] fatal: ${error}\n`)
    }
    // Always exit 0 — hooks must never block the agent
    process.exit(0)
  },
})
