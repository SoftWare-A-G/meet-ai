import { queryOptions } from '@tanstack/react-query'
import {
  fetchRooms,
  fetchProjects,
  fetchMessages,
  fetchLogs,
  fetchTasks,
  fetchTeamInfo,
  fetchAttachmentCounts,
  fetchTtsStatus,
} from './fetchers'
import { queryKeys } from './query-keys'
import type { TimelineItem } from '../hooks/useRoomTimeline'

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
  })
}

export function tasksQueryOptions(roomId: string) {
  return queryOptions({
    queryKey: queryKeys.rooms.tasks(roomId),
    queryFn: () => fetchTasks(roomId),
    staleTime: Infinity,
  })
}

export function teamInfoQueryOptions(roomId: string) {
  return queryOptions({
    queryKey: queryKeys.rooms.teamInfo(roomId),
    queryFn: () => fetchTeamInfo(roomId),
    staleTime: Infinity,
  })
}

export function attachmentCountsQueryOptions(roomId: string) {
  return queryOptions({
    queryKey: queryKeys.rooms.attachmentCounts(roomId),
    queryFn: () => fetchAttachmentCounts(roomId),
    staleTime: Infinity,
  })
}

// ── Global queries ────────────────────────────────────────────────────

export const ttsStatusQueryOptions = queryOptions({
  queryKey: queryKeys.tts.status,
  queryFn: fetchTtsStatus,
  staleTime: Infinity,
})
