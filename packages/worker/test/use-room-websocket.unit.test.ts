import { describe, expect, it } from 'vitest'
import { getLastTimelineSeq } from '../src/app/hooks/useRoomWebSocket'
import type { TimelineItem } from '../src/app/hooks/useRoomTimeline'

function item(partial: Partial<TimelineItem> = {}): TimelineItem {
  return {
    sender: 'tester',
    content: 'message',
    created_at: '2026-03-21T00:00:00.000Z',
    ...partial,
  }
}

describe('getLastTimelineSeq', () => {
  it('returns 0 when the timeline cache is empty', () => {
    expect(getLastTimelineSeq(undefined)).toBe(0)
    expect(getLastTimelineSeq([])).toBe(0)
  })

  it('returns the highest message seq from cached timeline items', () => {
    const items = [
      item({ id: 'm1', content: 'first', seq: 4 }),
      item({ id: 'm2', content: 'second', created_at: '2026-03-21T00:00:01.000Z' }),
      item({ id: 'm3', content: 'third', created_at: '2026-03-21T00:00:02.000Z', seq: 9 }),
      item({
        id: 'm4',
        content: 'log',
        created_at: '2026-03-21T00:00:03.000Z',
        type: 'log',
        seq: 7,
      }),
    ]

    expect(getLastTimelineSeq(items)).toBe(9)
  })
})
