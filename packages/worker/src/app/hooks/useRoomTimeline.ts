import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import type { InfiniteData } from '@tanstack/react-query'
import { fetchMessagesSinceSeq } from '../lib/fetchers'
import { queryKeys } from '../lib/query-keys'
import { timelineInfiniteQueryOptions } from '../lib/query-options'
import type { TimelinePage } from '../lib/query-options'
import type { Message } from '../lib/types'

export type TimelineItem = Message & {
  tempId?: string
  status?: 'sent' | 'pending' | 'failed'
  attachmentIds?: string[]
}

function deduplicateTimeline(items: TimelineItem[]) {
  const seen = new Set<string>()
  const result: TimelineItem[] = []
  for (const item of items) {
    const key = item.id ?? item.tempId ?? ''
    if (key && seen.has(key)) continue
    if (key) seen.add(key)
    result.push(item)
  }
  return result
}

function sortTimeline(items: TimelineItem[]) {
  return items.sort((a, b) => {
    if (a.seq != null && b.seq != null) return a.seq - b.seq
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })
}

export function mergeIntoTimeline(existing: TimelineItem[], incoming: TimelineItem[]) {
  const knownIds = new Set<string>()
  for (const item of existing) {
    if (item.id) knownIds.add(item.id)
    if (item.tempId) knownIds.add(item.tempId)
  }

  const newItems: TimelineItem[] = []
  for (const item of incoming) {
    if (item.id && knownIds.has(item.id)) continue
    if (item.tempId && knownIds.has(item.tempId)) continue
    newItems.push(item)
  }

  if (newItems.length === 0) return existing
  return sortTimeline([...existing, ...newItems])
}

export function reconcileOptimistic(
  existing: TimelineItem[],
  confirmed: TimelineItem,
) {
  const idx = existing.findIndex(
    m => m.tempId && m.content === confirmed.content,
  )
  if (idx !== -1) {
    const updated = [...existing]
    updated[idx] = { ...confirmed, tempId: existing[idx].tempId, status: 'sent' }
    return updated
  }
  return sortTimeline(deduplicateTimeline([...existing, { ...confirmed, status: 'sent' }]))
}

/** Flatten all pages into a single sorted, deduplicated TimelineItem array. */
function flattenPages(data: InfiniteData<TimelinePage>): TimelineItem[] {
  const all: TimelineItem[] = []
  for (const page of data.pages) {
    all.push(...page.messages)
  }
  return sortTimeline(deduplicateTimeline(all))
}

export function useRoomTimeline(roomId: string) {
  const result = useInfiniteQuery(timelineInfiniteQueryOptions(roomId))

  const timeline = result.data ? flattenPages(result.data) : []

  return {
    data: timeline,
    isLoading: result.isLoading,
    error: result.error,
    hasPreviousPage: result.hasPreviousPage,
    isFetchingPreviousPage: result.isFetchingPreviousPage,
    fetchPreviousPage: result.fetchPreviousPage,
  }
}

/**
 * Provides functions to manipulate the timeline cache from components
 * without directly accessing queryClient.
 */
export function useTimelineUpdater(roomId: string | null) {
  const queryClient = useQueryClient()

  function appendOptimistic(item: TimelineItem) {
    queryClient.setQueryData<InfiniteData<TimelinePage>>(
      queryKeys.rooms.timeline(roomId!),
      old => {
        if (!old || old.pages.length === 0) {
          return { pages: [{ messages: [item], hasMore: false }], pageParams: [undefined] }
        }
        const lastPage = old.pages[old.pages.length - 1]
        const updatedLast = { ...lastPage, messages: [...lastPage.messages, item] }
        return { ...old, pages: [...old.pages.slice(0, -1), updatedLast] }
      },
    )
  }

  function updateItemStatus(tempId: string, status: 'sent' | 'pending' | 'failed') {
    queryClient.setQueryData<InfiniteData<TimelinePage>>(
      queryKeys.rooms.timeline(roomId!),
      old => {
        if (!old) return old
        return {
          ...old,
          pages: old.pages.map(page => ({
            ...page,
            messages: page.messages.map(m =>
              m.tempId === tempId ? { ...m, status } : m,
            ),
          })),
        }
      },
    )
  }

  function appendItems(items: TimelineItem[]) {
    queryClient.setQueryData<InfiniteData<TimelinePage>>(
      queryKeys.rooms.timeline(roomId!),
      old => {
        if (!old || old.pages.length === 0) {
          return { pages: [{ messages: items, hasMore: false }], pageParams: [undefined] }
        }
        const lastPage = old.pages[old.pages.length - 1]
        const merged = mergeIntoTimeline(lastPage.messages, items)
        const updatedLast = { ...lastPage, messages: merged }
        return { ...old, pages: [...old.pages.slice(0, -1), updatedLast] }
      },
    )
  }

  return { appendOptimistic, updateItemStatus, appendItems }
}

/**
 * Returns a function to fetch and merge missed messages since a given seq
 * into the timeline cache. Used for WS reconnect catch-up.
 */
export function useTimelineCatchUp(roomId: string | null) {
  const queryClient = useQueryClient()

  return async (lastSeq: number) => {
    if (!roomId || lastSeq === 0) return 0
    const missed = await fetchMessagesSinceSeq(roomId, lastSeq)
    if (missed.length === 0) return 0

    let maxSeq = lastSeq
    for (const msg of missed) {
      if (msg.seq != null && msg.seq > maxSeq) {
        maxSeq = msg.seq
      }
    }

    await queryClient.cancelQueries({ queryKey: queryKeys.rooms.timeline(roomId) })
    queryClient.setQueryData<InfiniteData<TimelinePage>>(
      queryKeys.rooms.timeline(roomId),
      old => {
        const tagged = missed.map(m => ({ ...m, status: 'sent' as const }))
        if (!old || old.pages.length === 0) {
          return { pages: [{ messages: tagged, hasMore: false }], pageParams: [undefined] }
        }
        const lastPage = old.pages[old.pages.length - 1]
        const merged = mergeIntoTimeline(lastPage.messages, tagged)
        const updatedLast = { ...lastPage, messages: merged }
        return { ...old, pages: [...old.pages.slice(0, -1), updatedLast] }
      },
    )

    return maxSeq
  }
}
