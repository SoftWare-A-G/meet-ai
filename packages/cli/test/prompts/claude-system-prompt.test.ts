import { test, expect, describe } from 'bun:test'
import { buildClaudeSystemPrompt } from '@meet-ai/cli/lib/prompts/claude-system-prompt'

const ROOM_ID = 'test-room-abc-123'

describe('buildClaudeSystemPrompt', () => {
  const prompt = buildClaudeSystemPrompt(ROOM_ID)

  test('returns a non-empty string', () => {
    expect(typeof prompt).toBe('string')
    expect(prompt.length).toBeGreaterThan(0)
  })

  test('contains the provided roomId', () => {
    expect(prompt).toContain(ROOM_ID)
  })

  describe('contains key sections', () => {
    test('Agent Colors section', () => {
      expect(prompt).toContain('## Agent Colors')
    })

    test('Sending Messages section', () => {
      expect(prompt).toContain('## Sending Messages')
    })

    test('Identical Output Procedure', () => {
      expect(prompt).toContain('### Identical Output Procedure')
    })

    test('Send Commands section', () => {
      expect(prompt).toContain('## Send Commands')
    })

    test('Message Format section', () => {
      expect(prompt).toContain('## Message Format')
    })

    test('Polling section', () => {
      expect(prompt).toContain('## Polling')
    })

    test('Listening section', () => {
      expect(prompt).toContain('## Listening')
    })

    test('Progress Updates section', () => {
      expect(prompt).toContain('## Progress Updates')
    })

    test('Canvas section', () => {
      expect(prompt).toContain('## Canvas')
    })

    test('Planning section', () => {
      expect(prompt).toContain('## Planning')
      expect(prompt).toContain('orchestrator must create the plan itself using plan mode (EnterPlanMode)')
      expect(prompt).toContain('Never delegate planning to teammate agents')
      expect(prompt).toContain('Never send teammate agents into plan mode')
    })

    test('Task Management section', () => {
      expect(prompt).toContain('## Task Management')
      expect(prompt).toContain('### Delegation')
      expect(prompt).toContain('Every delegated work item must have a task')
      expect(prompt).toContain('in_progress')
      expect(prompt).toContain('completed')
      expect(prompt).toContain('blocked')
      expect(prompt).toContain('### Post-Plan Tasks')
      expect(prompt).toContain('break it into concrete tasks')
    })

    test('Asking the User section', () => {
      expect(prompt).toContain('## Asking the User')
      expect(prompt).toContain('AskUserQuestion')
      expect(prompt).toContain('question-review hook')
    })

    test('Message Routing section', () => {
      expect(prompt).toContain('## Message Routing')
      expect(prompt).toContain('ignore it completely')
      expect(prompt).toContain('standing by')
      expect(prompt).toContain('Silence is acceptable')
    })

    test('Rules section', () => {
      expect(prompt).toContain('## Rules')
    })
  })

  describe('does NOT contain removed content', () => {
    test('no sending tasks section', () => {
      expect(prompt).not.toContain('## Sending Tasks')
    })

    test('no inbox format section', () => {
      expect(prompt).not.toContain('## Inbox Format')
    })

    test('no logs section', () => {
      expect(prompt).not.toContain('## Logs')
    })

    test('no room creation', () => {
      expect(prompt).not.toContain('create-room')
    })
  })

  describe('Canvas section details', () => {
    test('includes discovery commands', () => {
      expect(prompt).toContain('### Discovery')
      expect(prompt).toContain('canvas tools')
      expect(prompt).toContain('canvas shape-types')
      expect(prompt).toContain('get_canvas_state')
    })

    test('includes CRUD operations', () => {
      expect(prompt).toContain('### Creating Shapes')
      expect(prompt).toContain('### Updating Shapes')
      expect(prompt).toContain('### Deleting Shapes')
      expect(prompt).toContain('### Inspecting the Canvas')
    })

    test('includes canvas rules', () => {
      expect(prompt).toContain('### Canvas Rules')
      expect(prompt).toContain('shape:')
    })
  })
})
