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
      expect(joined).toContain('agent-team')
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
      const teamIndex = joined.indexOf('agent-team')
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
})
