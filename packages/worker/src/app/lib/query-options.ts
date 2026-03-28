import { queryOptions, infiniteQueryOptions } from '@tanstack/react-query'
import {
  ApiError,
  fetchRooms,
  fetchProjects,
  fetchMessages,
  fetchLogs,
  fetchLatestMessages,
  fetchMessagesBefore,
  fetchTasks,
  fetchTeamInfo,
  fetchAttachmentCounts,
  fetchTtsStatus,
} from './fetchers'
import { queryKeys } from './query-keys'
import type { TimelineItem } from '../hooks/useRoomTimeline'

/** Don't retry on 404 — the resource doesn't exist, retrying won't help. */
function retryUnless404(failureCount: number, error: Error) {
  if (error instanceof ApiError && error.status === 404) return false
  return failureCount < 3
}

// ── Room-level queries ────────────────────────────────────────────────

export const roomsQueryOptions = queryOptions({
  queryKey: queryKeys.rooms.all,
  queryFn: fetchRooms,
  refetchInterval: 60_000,
})

export const projectsQueryOptions = queryOptions({
  queryKey: queryKeys.projects.all,
  queryFn: fetchProjects,
})

// ── Per-room queries (parameterised) ──────────────────────────────────

export function timelineQueryOptions(roomId: string) {
  return queryOptions({
    queryKey: queryKeys.rooms.timeline(roomId),
    queryFn: async (): Promise<TimelineItem[]> => {
      const [messages, logs] = await Promise.all([
        fetchMessages(roomId),
        fetchLogs(roomId),
      ])
      const taggedMessages = messages.map(m => ({ ...m, status: 'sent' as const }))
      const taggedLogs = logs.map(l => ({ ...l, type: 'log' as const, status: 'sent' as const }))

      const seen = new Set<string>()
      const deduped: TimelineItem[] = []
      for (const item of [...taggedMessages, ...taggedLogs]) {
        const key = item.id ?? ''
        if (key && seen.has(key)) continue
        if (key) seen.add(key)
        deduped.push(item)
      }

      return deduped.sort((a, b) => {
        if (a.seq != null && b.seq != null) return a.seq - b.seq
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      })
    },
    staleTime: Infinity,
    retry: retryUnless404,
  })
}

export type TimelinePage = {
  messages: TimelineItem[]
  hasMore: boolean
}

export function timelineInfiniteQueryOptions(roomId: string) {
  return infiniteQueryOptions({
    queryKey: queryKeys.rooms.timeline(roomId),
    queryFn: async ({ pageParam }): Promise<TimelinePage> => {
      if (pageParam) {
        // Subsequent pages — fetch older messages only
        const data = await fetchMessagesBefore(roomId, pageParam.beforeSeq)
        return {
          messages: data.messages.map(m => ({ ...m, status: 'sent' as const })),
          hasMore: data.hasMore,
        }
      }
      // Initial page — fetch latest messages + all logs
      const [paginated, logs] = await Promise.all([
        fetchLatestMessages(roomId),
        fetchLogs(roomId),
      ])
      const taggedMessages = paginated.messages.map(m => ({ ...m, status: 'sent' as const }))
      const taggedLogs = logs.map(l => ({ ...l, type: 'log' as const, status: 'sent' as const }))

      const seen = new Set<string>()
      const deduped: TimelineItem[] = []
      for (const item of [...taggedMessages, ...taggedLogs]) {
        const key = item.id ?? ''
        if (key && seen.has(key)) continue
        if (key) seen.add(key)
        deduped.push(item)
      }

      const sorted = deduped.sort((a, b) => {
        if (a.seq != null && b.seq != null) return a.seq - b.seq
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      })

      return { messages: sorted, hasMore: paginated.hasMore }
    },
    initialPageParam: undefined as { beforeSeq: number } | undefined,
    getPreviousPageParam: (firstPage) => {
      if (!firstPage.hasMore) return undefined
      const seqs = firstPage.messages
        .map(m => m.seq)
        .filter((s): s is number => s != null)
      if (seqs.length === 0) return undefined
      return { beforeSeq: Math.min(...seqs) }
    },
    getNextPageParam: () => undefined,
    staleTime: Infinity,
    retry: retryUnless404,
  })
}

export function tasksQueryOptions(roomId: string) {
  return queryOptions({
    queryKey: queryKeys.rooms.tasks(roomId),
    queryFn: () => fetchTasks(roomId),
    staleTime: Infinity,
    retry: retryUnless404,
  })
}

export function teamInfoQueryOptions(roomId: string) {
  return queryOptions({
    queryKey: queryKeys.rooms.teamInfo(roomId),
    queryFn: () => fetchTeamInfo(roomId),
    staleTime: Infinity,
    retry: retryUnless404,
  })
}

export function attachmentCountsQueryOptions(roomId: string) {
  return queryOptions({
    queryKey: queryKeys.rooms.attachmentCounts(roomId),
    queryFn: () => fetchAttachmentCounts(roomId),
    staleTime: Infinity,
    retry: retryUnless404,
  })
}

// ── Global queries ────────────────────────────────────────────────────

export const ttsStatusQueryOptions = queryOptions({
  queryKey: queryKeys.tts.status,
  queryFn: fetchTtsStatus,
  staleTime: Infinity,
})
