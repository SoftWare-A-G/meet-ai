import { test, expect, describe } from 'bun:test'
import { buildCodexBootstrapPrompt } from '@meet-ai/cli/lib/prompts/codex-bootstrap-prompt'

describe('buildCodexBootstrapPrompt', () => {
  const promptLines = buildCodexBootstrapPrompt()
  const prompt = promptLines.join('\n')

  test('returns a non-empty string array', () => {
    expect(Array.isArray(promptLines)).toBe(true)
    expect(promptLines.length).toBeGreaterThan(0)
  })

  test('every element is a string', () => {
    for (const line of promptLines) {
      expect(typeof line).toBe('string')
    }
  })

  describe('contains required sections', () => {
    test('mention routing rule', () => {
      expect(prompt).toContain('If a user input starts with a username mention and that username is not yours, do not answer it.')
      expect(prompt).toContain('Do not reply with "standing by" or any other acknowledgment to messages addressed to someone else.')
    })

    test('Planning section', () => {
      expect(prompt).toContain('## Planning')
      expect(prompt).toContain('update_plan')
      expect(prompt).toContain('request_user_input')
      expect(prompt).toContain('Do not create a plan for small, clear work')
      expect(prompt).toContain('If the work is small and clear, implement it directly.')
    })

    test('Plan Structure section', () => {
      expect(prompt).toContain('## Plan Structure')
      expect(prompt).toContain('### File Map')
      expect(prompt).toContain('### Tasks')
      expect(prompt).toContain('actual test code')
      expect(prompt).toContain('actual implementation code')
    })

    test('Quality Bar section', () => {
      expect(prompt).toContain('## Quality Bar')
      expect(prompt).toContain('Exact file paths are required.')
      expect(prompt).toContain('Exact test commands are required.')
      expect(prompt).toContain('Explicit commit checkpoints after each passing test block are required.')
    })

    test('Task Management section', () => {
      expect(prompt).toContain('## Task Management')
      expect(prompt).toContain('create_task')
      expect(prompt).toContain('update_task')
      expect(prompt).toContain('list_tasks')
      expect(prompt).toContain('get_task')
    })

    test('Canvas section', () => {
      expect(prompt).toContain('## Canvas')
      expect(prompt).toContain('get_canvas_state')
      expect(prompt).toContain('list_canvas_shape_types')
      expect(prompt).toContain('add_canvas_note')
    })
  })

  describe('does NOT contain removed content', () => {
    test('no meet-ai cli instruction', () => {
      expect(prompt).not.toContain('Use Meet AI commands through the local CLI available in this environment.')
    })

    test('no claude team startup instructions', () => {
      expect(prompt).not.toContain('Start agent-team mode')
      expect(prompt).not.toContain('Send a brief welcome message to the room.')
      expect(prompt).not.toContain('set_interaction_mode')
    })

    test('no unconditional plan requirement', () => {
      expect(prompt).not.toContain('Before implementing, produce an execution-grade plan using update_plan.')
      expect(prompt).not.toContain('Do not start implementation until the plan is approved, unless the user explicitly says to proceed.')
    })
  })
})
