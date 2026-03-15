import { describe, it, expect } from 'vitest'
import { parseAgentActivity } from '../src/app/lib/activity'
import { formatRelativeTime } from '../src/app/lib/dates'
import type { Message } from '../src/app/lib/types'

// ─── parseAgentActivity ─────────────────────────────────────────────────────

describe('parseAgentActivity', () => {
  it('parses a valid log message with agent sender', () => {
    const msg: Message = {
      sender: 'hook-identity',
      content: 'Edit: ChatView.tsx',
      created_at: '2026-03-15T10:00:00Z',
      type: 'log',
    }
    const result = parseAgentActivity(msg)
    expect(result).toEqual({ agentName: 'hook-identity', action: 'Edit: ChatView.tsx' })
  })

  it('filters out sender: "hook" (unattributed logs)', () => {
    const msg: Message = {
      sender: 'hook',
      content: 'Read: file.ts',
      created_at: '2026-03-15T10:00:00Z',
      type: 'log',
    }
    expect(parseAgentActivity(msg)).toBeNull()
  })

  it('returns null for non-log messages', () => {
    const msg: Message = {
      sender: 'user',
      content: 'Hello',
      created_at: '2026-03-15T10:00:00Z',
      type: 'message',
    }
    expect(parseAgentActivity(msg)).toBeNull()
  })

  it('returns null for messages without type', () => {
    const msg: Message = {
      sender: 'agent-1',
      content: 'Hello',
      created_at: '2026-03-15T10:00:00Z',
    }
    expect(parseAgentActivity(msg)).toBeNull()
  })

  it('returns null for log with empty content', () => {
    const msg: Message = {
      sender: 'agent-1',
      content: '   ',
      created_at: '2026-03-15T10:00:00Z',
      type: 'log',
    }
    expect(parseAgentActivity(msg)).toBeNull()
  })

  it('returns null for log with empty sender', () => {
    const msg: Message = {
      sender: '',
      content: 'Edit: file.ts',
      created_at: '2026-03-15T10:00:00Z',
      type: 'log',
    }
    expect(parseAgentActivity(msg)).toBeNull()
  })

  it('trims whitespace from action content', () => {
    const msg: Message = {
      sender: 'my-agent',
      content: '  Bash: bun run test  ',
      created_at: '2026-03-15T10:00:00Z',
      type: 'log',
    }
    const result = parseAgentActivity(msg)
    expect(result).toEqual({ agentName: 'my-agent', action: 'Bash: bun run test' })
  })
})

// ─── formatRelativeTime ─────────────────────────────────────────────────────

describe('formatRelativeTime', () => {
  it('returns seconds ago for recent timestamps', () => {
    const now = new Date()
    const tenSecsAgo = new Date(now.getTime() - 10_000).toISOString()
    expect(formatRelativeTime(tenSecsAgo)).toBe('10s ago')
  })

  it('returns minutes ago for timestamps over 60s', () => {
    const now = new Date()
    const threeMinAgo = new Date(now.getTime() - 180_000).toISOString()
    expect(formatRelativeTime(threeMinAgo)).toBe('3m ago')
  })

  it('returns hours ago for timestamps over 60m', () => {
    const now = new Date()
    const twoHoursAgo = new Date(now.getTime() - 7_200_000).toISOString()
    expect(formatRelativeTime(twoHoursAgo)).toBe('2h ago')
  })

  it('returns "just now" for future timestamps', () => {
    const future = new Date(Date.now() + 10_000).toISOString()
    expect(formatRelativeTime(future)).toBe('just now')
  })

  it('returns "0s ago" for exactly now', () => {
    const now = new Date().toISOString()
    const result = formatRelativeTime(now)
    // Could be 0s or 1s depending on timing
    expect(result).toMatch(/^[01]s ago$/)
  })
})
