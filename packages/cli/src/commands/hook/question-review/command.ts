import { defineCommand } from 'citty'
import { processQuestionReview } from './usecase'

export default defineCommand({
  meta: {
    name: 'question-review',
    description: 'Handle Claude Code AskUser permission hook — routes questions to meet-ai room for review',
  },
  async run() {
    try {
      let input = ''
      for await (const chunk of process.stdin) {
        input += chunk
      }
      await processQuestionReview(input)
    } catch (error) {
      process.stderr.write(`[question-review] fatal: ${error}\n`)
    }
    // Always exit 0 — hook must never block the agent
    process.exit(0)
  },
})
