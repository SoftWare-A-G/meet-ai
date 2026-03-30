import { describe, expect, it } from 'vitest'
import { getLastTimelineSeq } from '../src/app/hooks/useRoomWebSocket'
import type { TimelineItem } from '../src/app/hooks/useRoomTimeline'
import type { TimelinePage } from '../src/app/lib/query-options'
import type { InfiniteData } from '@tanstack/react-query'

function item(partial: Partial<TimelineItem> = {}): TimelineItem {
  return {
    sender: 'tester',
    content: 'message',
    created_at: '2026-03-21T00:00:00.000Z',
    ...partial,
  }
}

function infiniteData(pages: TimelinePage[]): InfiniteData<TimelinePage> {
  return {
    pages,
    pageParams: pages.map((_, i) => (i === 0 ? undefined : i)),
  }
}

describe('getLastTimelineSeq', () => {
  it('returns 0 when the timeline cache is undefined', () => {
    expect(getLastTimelineSeq(undefined)).toBe(0)
  })

  it('returns 0 when the timeline cache has no pages', () => {
    expect(getLastTimelineSeq(infiniteData([]))).toBe(0)
  })

  it('returns 0 when pages have no messages', () => {
    expect(getLastTimelineSeq(infiniteData([{ messages: [], hasMore: false }]))).toBe(0)
  })

  it('returns the highest message seq from cached timeline pages', () => {
    const data = infiniteData([
      {
        messages: [
          item({ id: 'm1', content: 'first', seq: 4 }),
          item({ id: 'm2', content: 'second', created_at: '2026-03-21T00:00:01.000Z' }),
        ],
        hasMore: true,
      },
      {
        messages: [
          item({ id: 'm3', content: 'third', created_at: '2026-03-21T00:00:02.000Z', seq: 9 }),
          item({
            id: 'm4',
            content: 'log',
            created_at: '2026-03-21T00:00:03.000Z',
            type: 'log',
            seq: 7,
          }),
        ],
        hasMore: false,
      },
    ])

    expect(getLastTimelineSeq(data)).toBe(9)
  })

  it('ignores log items when computing max seq', () => {
    const data = infiniteData([
      {
        messages: [
          item({ id: 'm1', content: 'msg', seq: 3 }),
          item({ id: 'm2', content: 'log', type: 'log', seq: 15 }),
        ],
        hasMore: false,
      },
    ])

    expect(getLastTimelineSeq(data)).toBe(3)
  })
})
