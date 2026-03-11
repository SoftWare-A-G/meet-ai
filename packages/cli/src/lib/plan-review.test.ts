import { describe, expect, it } from 'bun:test'
import { formatCodexPlanReviewContent } from './plan-review'

describe('formatCodexPlanReviewContent', () => {
  it('renders preview wording and draft status for pending steps', () => {
    const content = formatCodexPlanReviewContent({
      explanation: 'Concrete plan',
      plan: [
        { step: 'Apply the requested wording changes.', status: 'inProgress' },
        { step: 'Show the updated plan.', status: 'pending' },
      ],
    })

    expect(content).toContain('**Plan preview**')
    expect(content).toContain('1. [in_progress] Apply the requested wording changes.')
    expect(content).toContain('2. [draft] Show the updated plan.')
    expect(content).not.toContain('**Plan review**')
    expect(content).not.toContain('[pending]')
  })
})
