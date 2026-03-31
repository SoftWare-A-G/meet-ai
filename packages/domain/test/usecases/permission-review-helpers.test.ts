import { describe, expect, it } from 'vitest'
import {
  parsePermissionInput,
  isExcludedTool,
  EXCLUDED_TOOLS,
  formatPermissionRequest,
  resolveDecisionOutput,
} from '../../src/usecases/permission-review-helpers'

describe('parsePermissionInput', () => {
  it('parses valid JSON with required fields', () => {
    const raw = JSON.stringify({
      session_id: 'abc',
      tool_name: 'Bash',
      hook_event_name: 'PermissionRequest',
    })
    const result = parsePermissionInput(raw)
    expect(result.isOk()).toBe(true)
    const input = result.unwrap()
    expect(input.session_id).toBe('abc')
    expect(input.tool_name).toBe('Bash')
  })

  it('returns ParseError for invalid JSON', () => {
    const result = parsePermissionInput('not json')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error._tag).toBe('ParseError')
    }
  })

  it('returns ValidationError for missing tool_name', () => {
    const result = parsePermissionInput(JSON.stringify({ session_id: 'abc' }))
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error._tag).toBe('ValidationError')
    }
  })

  it('returns ValidationError for missing session_id', () => {
    const result = parsePermissionInput(JSON.stringify({ tool_name: 'Bash' }))
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error._tag).toBe('ValidationError')
    }
  })

  it('returns ValidationError for invalid hook_event_name', () => {
    const result = parsePermissionInput(JSON.stringify({
      session_id: 'abc',
      tool_name: 'Bash',
      hook_event_name: 'SomethingElse',
    }))
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error._tag).toBe('ValidationError')
    }
  })

  it('preserves Zod message for non-too_small failures', () => {
    const result = parsePermissionInput(JSON.stringify({
      session_id: 123,
      tool_name: 'Bash',
      hook_event_name: 'PermissionRequest',
    }))
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error._tag).toBe('ValidationError')
      expect(result.error.message).not.toContain('is required')
    }
  })
})

describe('isExcludedTool', () => {
  it('excludes ExitPlanMode', () => expect(isExcludedTool('ExitPlanMode')).toBe(true))
  it('excludes AskUserQuestion', () => expect(isExcludedTool('AskUserQuestion')).toBe(true))
  it('allows Bash', () => expect(isExcludedTool('Bash')).toBe(false))
  it('exports the list', () => expect(EXCLUDED_TOOLS).toContain('ExitPlanMode'))
})

describe('formatPermissionRequest', () => {
  it('formats tool name as header', () => {
    const text = formatPermissionRequest('Bash', { command: 'ls -la' })
    expect(text).toContain('**Permission request: Bash**')
    expect(text).toContain('**command:**')
  })

  it('truncates long values at 200 chars', () => {
    const text = formatPermissionRequest('Edit', { content: 'x'.repeat(300) })
    expect(text).toContain('...')
  })

  it('handles no tool input', () => {
    const text = formatPermissionRequest('Read')
    expect(text).toBe('**Permission request: Read**\n')
  })
})

describe('resolveDecisionOutput', () => {
  it('returns allow output for approved', () => {
    const result = resolveDecisionOutput('approved')
    const output = result.unwrap()
    expect(output?.hookSpecificOutput.decision.behavior).toBe('allow')
  })

  it('returns deny output with feedback for denied', () => {
    const result = resolveDecisionOutput('denied', 'Not allowed')
    const output = result.unwrap()
    expect(output?.hookSpecificOutput.decision).toEqual({
      behavior: 'deny',
      message: 'Not allowed',
    })
  })

  it('uses default message when denied without feedback', () => {
    const result = resolveDecisionOutput('denied')
    const output = result.unwrap()
    expect(output?.hookSpecificOutput.decision).toEqual({
      behavior: 'deny',
      message: 'Permission denied by user.',
    })
  })

  it('returns null for expired', () => {
    const result = resolveDecisionOutput('expired')
    const output = result.unwrap()
    expect(output).toBeNull()
  })
})
