import { test, expect, describe } from 'bun:test'
import { buildClaudeStartingPrompt } from '@meet-ai/cli/lib/prompts/claude-starting-prompt'

const ROOM_ID = 'test-room-abc-123'

describe('buildClaudeStartingPrompt', () => {
  const steps = buildClaudeStartingPrompt(ROOM_ID)

  test('returns a non-empty string array', () => {
    expect(Array.isArray(steps)).toBe(true)
    expect(steps.length).toBeGreaterThan(0)
  })

  test('every element is a string', () => {
    for (const step of steps) {
      expect(typeof step).toBe('string')
    }
  })

  test('contains the provided roomId', () => {
    const joined = steps.join('\n')
    expect(joined).toContain(ROOM_ID)
  })

  describe('contains required steps', () => {
    test('team creation step', () => {
      const joined = steps.join('\n')
      expect(joined).toContain('Agent Team')
    })

    test('meet-ai.json step', () => {
      const joined = steps.join('\n')
      expect(joined).toContain('meet-ai.json')
    })

    test('inbox listener step', () => {
      const joined = steps.join('\n')
      expect(joined).toContain('listen')
      expect(joined).toContain('--inbox')
    })
  })

  describe('steps are in the correct order', () => {
    test('team creation comes before meet-ai.json', () => {
      const joined = steps.join('\n')
      const teamIndex = joined.indexOf('Agent Team')
      const meetAiJsonIndex = joined.indexOf('meet-ai.json')
      expect(teamIndex).toBeLessThan(meetAiJsonIndex)
    })

    test('meet-ai.json comes before inbox listener', () => {
      const joined = steps.join('\n')
      const meetAiJsonIndex = joined.indexOf('meet-ai.json')
      const listenIndex = joined.indexOf('listen')
      expect(meetAiJsonIndex).toBeLessThan(listenIndex)
    })
  })

  describe('does NOT contain removed content', () => {
    test('no room creation', () => {
      const joined = steps.join('\n')
      expect(joined).not.toContain('create-room')
    })
  })

  describe('agent-team confusion fix', () => {
    test('mentions the TeamCreate tool by name', () => {
      const joined = steps.join('\n')
      expect(joined).toContain('TeamCreate')
    })

    test('explicitly states TeamCreate is NOT a meet-ai CLI command', () => {
      const joined = steps.join('\n')
      expect(joined).toMatch(/NOT.*meet-ai/i)
    })

    test('instructs the model to generate a creative slug', () => {
      const joined = steps.join('\n').toLowerCase()
      expect(joined).toContain('slug')
      expect(joined).toContain('creative')
    })

    test('shows at least one example slug', () => {
      const joined = steps.join('\n')
      expect(joined).toMatch(/crimson-otter|bold-river-falcon|silent-meadow/)
    })

    test('forbids defaulting to team-lead as the team slug', () => {
      const joined = steps.join('\n')
      expect(joined).toMatch(/do NOT default to/i)
      expect(joined).toContain('team-lead')
    })

    test('forbids using the literal <team-name> placeholder', () => {
      const joined = steps.join('\n')
      expect(joined).toContain('<team-name>')
      expect(joined).toMatch(/do NOT use|not.*literal|literal.*placeholder/i)
    })
  })

  describe('home directory note', () => {
    test('mentions "home directory"', () => {
      const joined = steps.join('\n')
      expect(joined).toContain('home directory')
    })

    test('covers macOS, Linux, and Windows path examples', () => {
      const joined = steps.join('\n')
      expect(joined).toMatch(/\/Users\//)
      expect(joined).toMatch(/\/home\//)
      expect(joined).toMatch(/C:\\Users\\/)
    })

    test('warns about file tools needing absolute paths', () => {
      const note = steps.find((line) => line.includes('home directory'))
      expect(note).toBeDefined()
      expect(note).toMatch(/absolute/i)
      expect(note).toMatch(/Read|Write|Edit/)
    })

    test('note appears before Step 1', () => {
      const joined = steps.join('\n')
      const noteIndex = joined.indexOf('home directory')
      const stepOneIndex = joined.indexOf('Step 1')
      expect(noteIndex).toBeGreaterThanOrEqual(0)
      expect(stepOneIndex).toBeGreaterThanOrEqual(0)
      expect(noteIndex).toBeLessThan(stepOneIndex)
    })
  })
})
