import { useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { sendMessage } from '../lib/fetchers'
import { queryKeys } from '../lib/query-keys'
import { offlineQueue } from '../lib/offline-queue'
import type { TimelineItem } from './useRoomTimeline'

function generateTempId() {
  return `pending-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

export function useSendMessage(roomId: string, userName: string, apiKey: string) {
  const queryClient = useQueryClient()
  const { queue, remove } = offlineQueue
  const timelineKey = queryKeys.rooms.timeline(roomId)

  const mutation = useMutation({
    mutationFn: (vars: { content: string; attachmentIds?: string[]; tempId: string }) =>
      sendMessage({
        param: { id: roomId },
        json: {
          sender: userName,
          content: vars.content,
          ...(vars.attachmentIds?.length ? { attachment_ids: vars.attachmentIds } : {}),
        },
      }),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: timelineKey })
      const attachmentCount = vars.attachmentIds?.length ?? 0
      queryClient.setQueryData<TimelineItem[]>(
        timelineKey,
        old => {
          if (!old) {
            return [{
              sender: userName,
              content: vars.content,
              created_at: new Date().toISOString(),
              tempId: vars.tempId,
              status: 'pending',
              ...(attachmentCount > 0 && { attachment_count: attachmentCount, attachmentIds: vars.attachmentIds }),
            }]
          }
          // Bug 2 fix: if tempId already exists (retry case), update status instead of appending
          const existing = old.find(m => m.tempId === vars.tempId)
          if (existing) {
            return old.map(m => (m.tempId === vars.tempId ? { ...m, status: 'pending' as const } : m))
          }
          return [...old, {
            sender: userName,
            content: vars.content,
            created_at: new Date().toISOString(),
            tempId: vars.tempId,
            status: 'pending',
            ...(attachmentCount > 0 && { attachment_count: attachmentCount, attachmentIds: vars.attachmentIds }),
          }]
        },
      )
    },
    onError: async (_error, vars) => {
      // Mark as failed in timeline cache
      queryClient.setQueryData<TimelineItem[]>(
        timelineKey,
        old => old?.map(m => (m.tempId === vars.tempId ? { ...m, status: 'failed' as const } : m)) ?? [],
      )
      // Queue to IndexedDB for offline retry
      await queue({
        tempId: vars.tempId,
        roomId,
        sender: userName,
        content: vars.content,
        apiKey,
        timestamp: Date.now(),
        ...(vars.attachmentIds?.length ? { attachmentIds: vars.attachmentIds } : {}),
      })
    },
    // On success: WS echo will reconcile via reconcileOptimistic — no cache update needed here
  })

  const send = useCallback(
    (content: string, attachmentIds: string[] = []) => {
      const tempId = generateTempId()
      mutation.mutate({ content, attachmentIds, tempId })
    },
    [mutation],
  )

  const retry = useCallback(
    (tempId: string) => {
      const timeline = queryClient.getQueryData<TimelineItem[]>(timelineKey)
      const msg = timeline?.find(m => m.tempId === tempId)
      if (!msg) return
      // onMutate will update existing item to 'pending' (Bug 2 fix)
      mutation.mutate(
        { content: msg.content, attachmentIds: msg.attachmentIds, tempId },
        {
          onSuccess: async () => {
            await remove(tempId)
          },
          onError: () => {
            // Already handled by the mutation-level onError
          },
        },
      )
    },
    [queryClient, timelineKey, mutation, remove],
  )

  return { send, retry }
}
