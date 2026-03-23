import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchMessages, fetchLogs, fetchMessagesSinceSeq } from '../lib/fetchers'
import { queryKeys } from '../lib/query-keys'
import { timelineQueryOptions } from '../lib/query-options'
import type { Message } from '../lib/types'

export type TimelineItem = Message & {
  tempId?: string
  status?: 'sent' | 'pending' | 'failed'
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

export function useRoomTimeline(roomId: string) {
  const queryClient = useQueryClient()

  return useQuery({
    ...timelineQueryOptions(roomId),
    queryFn: async () => {
      const [messages, logs] = await Promise.all([
        fetchMessages(roomId),
        fetchLogs(roomId),
      ])
      const taggedMessages = messages.map(m => ({ ...m, status: 'sent' as const }))
      const taggedLogs = logs.map(l => ({ ...l, type: 'log' as const, status: 'sent' as const }))
      const serverItems = sortTimeline(deduplicateTimeline([...taggedMessages, ...taggedLogs]))

      // Preserve any pending/failed items already in the cache (e.g., restored offline queue)
      const cached = queryClient.getQueryData<TimelineItem[]>(queryKeys.rooms.timeline(roomId))
      if (cached) {
        const pendingItems = cached.filter(item => item.status === 'pending' || item.status === 'failed')
        if (pendingItems.length > 0) {
          return mergeIntoTimeline(serverItems, pendingItems)
        }
      }

      return serverItems
    },
  })
}

/**
 * Provides functions to manipulate the timeline cache from components
 * without directly accessing queryClient.
 */
export function useTimelineUpdater(roomId: string | null) {
  const queryClient = useQueryClient()

  function appendOptimistic(item: TimelineItem) {
    queryClient.setQueryData<TimelineItem[]>(
      queryKeys.rooms.timeline(roomId!),
      old => (old ? [...old, item] : [item]),
    )
  }

  function updateItemStatus(tempId: string, status: 'sent' | 'pending' | 'failed') {
    queryClient.setQueryData<TimelineItem[]>(
      queryKeys.rooms.timeline(roomId!),
      old => old?.map(m => (m.tempId === tempId ? { ...m, status } : m)) ?? [],
    )
  }

  function appendItems(items: TimelineItem[]) {
    queryClient.setQueryData<TimelineItem[]>(
      queryKeys.rooms.timeline(roomId!),
      old => {
        if (!old) return items
        return mergeIntoTimeline(old, items)
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
    queryClient.setQueryData<TimelineItem[]>(
      queryKeys.rooms.timeline(roomId),
      old => {
        if (!old) return missed.map(m => ({ ...m, status: 'sent' as const }))
        return mergeIntoTimeline(
          old,
          missed.map(m => ({ ...m, status: 'sent' as const })),
        )
      },
    )

    return maxSeq
  }
}
