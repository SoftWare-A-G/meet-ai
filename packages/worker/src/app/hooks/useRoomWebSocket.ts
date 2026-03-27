import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  ApiError,
  fetchMessages,
  fetchMessagesSinceSeq,
  fetchLogs,
  fetchLogsSinceSeq,
} from '../lib/fetchers'
import { queryKeys } from '../lib/query-keys'
import { useRoomStore } from '../stores/useRoomStore'
import { mergeIntoTimeline, reconcileOptimistic } from './useRoomTimeline'
import type { CommandsInfo, TaskItem, TeamInfoResponse } from '../lib/fetchers'
import type { Message, TerminalDataEvent } from '../lib/types'
import type { TimelineItem } from './useRoomTimeline'

type PlanDecisionEvent = {
  type: 'plan_decision'
  plan_review_id: string
  status: 'approved' | 'denied' | 'expired'
  feedback?: string | null
  decided_by?: string
  permission_mode?: string
}

type QuestionAnswerEvent = {
  type: 'question_answer'
  question_review_id: string
  status: 'answered' | 'expired'
  answers?: Record<string, string>
  answered_by?: string
}

type PermissionDecisionEvent = {
  type: 'permission_decision'
  permission_review_id: string
  status: 'approved' | 'denied' | 'expired'
  feedback?: string | null
  decided_by?: string
}

// Discriminated union for all WebSocket event types
type WsEvent =
  | (TeamInfoResponse & { type: 'team_info' })
  | CommandsInfo
  | { type: 'tasks_info'; tasks: TaskItem[] }
  | PlanDecisionEvent
  | QuestionAnswerEvent
  | PermissionDecisionEvent
  | TerminalDataEvent
  | (Omit<Message, 'type'> & { type: 'message' | 'log' })

function parseWsEvent(raw: string): WsEvent | null {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

type UseRoomWebSocketOptions = {
  onTerminalData?: (data: string) => void
}

const MIN_BACKOFF = 1000
const MAX_BACKOFF = 30000

export function getLastTimelineSeq(items: TimelineItem[] | undefined): number {
  let maxSeq = 0
  for (const item of items ?? []) {
    if (item.type !== 'log' && item.seq != null && item.seq > maxSeq) {
      maxSeq = item.seq
    }
  }
  return maxSeq
}

function getLastLogSeq(items: TimelineItem[] | undefined): number {
  let maxSeq = 0
  for (const item of items ?? []) {
    if (item.type === 'log' && item.seq != null && item.seq > maxSeq) {
      maxSeq = item.seq
    }
  }
  return maxSeq
}

export function useRoomWebSocket(
  roomId: string | null,
  apiKey: string | null,
  onMessage: (msg: Message) => void,
  options?: UseRoomWebSocketOptions
) {
  const wsRef = useRef<WebSocket | null>(null)
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage
  const onTerminalDataRef = useRef(options?.onTerminalData)
  onTerminalDataRef.current = options?.onTerminalData
  const queryClient = useQueryClient()
  const lastSeqRef = useRef(0)
  const lastLogSeqRef = useRef(0)
  const backoffRef = useRef(MIN_BACKOFF)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastPongRef = useRef(Date.now())
  const zombieCheckRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [connected, setConnected] = useState(true)

  useEffect(() => {
    if (!roomId || !apiKey) return
    const key = apiKey
    const cachedTimeline = queryClient.getQueryData<TimelineItem[]>(queryKeys.rooms.timeline(roomId))
    lastSeqRef.current = getLastTimelineSeq(cachedTimeline)
    lastLogSeqRef.current = getLastLogSeq(cachedTimeline)

    // Grab Zustand actions once (stable references, no re-render deps)
    const { setCommands, setPlanDecision, setQuestionAnswer, setPermissionDecision } =
      useRoomStore.getState()

    async function catchUp() {
      if (!roomId) return

      // Re-compute lastSeq from the current cache — the ref may be stale
      // (e.g. timeline loaded after the effect created the WS connection)
      const cached = queryClient.getQueryData<TimelineItem[]>(queryKeys.rooms.timeline(roomId))
      const cachedSeq = getLastTimelineSeq(cached)
      const seqBaseline = Math.max(lastSeqRef.current, cachedSeq)
      lastSeqRef.current = seqBaseline

      const cachedLogSeq = getLastLogSeq(cached)
      const logSeqBaseline = Math.max(lastLogSeqRef.current, cachedLogSeq)
      lastLogSeqRef.current = logSeqBaseline

      // Track whether this is a bootstrap (seq=0) or incremental catch-up
      const isBootstrap = seqBaseline === 0 && logSeqBaseline === 0

      try {
        // Fetch missed messages: incremental when we have a baseline,
        // full fetch as one-time bootstrap fallback when seq is unknown.
        const missedMessages =
          seqBaseline > 0
            ? await fetchMessagesSinceSeq(roomId, seqBaseline)
            : await fetchMessages(roomId)

        // Fetch missed logs: incremental when we have a baseline
        const freshLogs =
          logSeqBaseline > 0
            ? await fetchLogsSinceSeq(roomId, logSeqBaseline)
            : await fetchLogs(roomId)

        // Update lastSeqRef from new messages
        for (const msg of missedMessages) {
          if (msg.seq != null && msg.seq > lastSeqRef.current) {
            lastSeqRef.current = msg.seq
          }
        }

        // Update lastLogSeqRef from new logs
        for (const log of freshLogs) {
          if (log.seq != null && log.seq > lastLogSeqRef.current) {
            lastLogSeqRef.current = log.seq
          }
        }

        const taggedMessages = missedMessages.map(m => ({ ...m, status: 'sent' as const }))
        const taggedLogs = freshLogs.map(l => ({
          ...l,
          type: 'log' as const,
          status: 'sent' as const,
        }))
        const incoming = [...taggedMessages, ...taggedLogs]

        if (incoming.length === 0) return

        // Merge into timeline cache
        void queryClient.cancelQueries({ queryKey: queryKeys.rooms.timeline(roomId) })
        queryClient.setQueryData<TimelineItem[]>(queryKeys.rooms.timeline(roomId), old => {
          if (!old) return incoming
          return mergeIntoTimeline(old, incoming)
        })

        // Side effects for incremental catch-up only — bootstrap (seq=0)
        // repairs state without replaying notifications/haptics for old messages
        if (!isBootstrap) {
          for (const msg of missedMessages) {
            onMessageRef.current?.(msg)
          }
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          console.warn('[ws] room not found (404), stopping reconnection')
          // Close the WebSocket — the onclose handler won't reconnect
          // because we null out wsRef before closing
          if (wsRef.current) {
            const ws = wsRef.current
            wsRef.current = null
            ws.close()
          }
          return
        }
        console.warn('[ws] catchUp failed, heartbeat will retry', error)
      }
    }

    function connect() {
      if (wsRef.current) wsRef.current.close()
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
      const tokenParam = `?token=${encodeURIComponent(key)}`
      const ws = new WebSocket(
        `${protocol}//${location.host}/api/rooms/${roomId}/ws${tokenParam}&client=web`
      )

      ws.onopen = () => {
        setConnected(true)
        backoffRef.current = MIN_BACKOFF
        lastPongRef.current = Date.now()

        // Start heartbeat — edge auto-responds without waking the DO
        if (heartbeatRef.current) clearInterval(heartbeatRef.current)
        heartbeatRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            if (Date.now() - lastPongRef.current > 45_000) {
              // Zombie connection — force reconnect
              if (roomId) {
                queryClient.invalidateQueries({ queryKey: queryKeys.rooms.timeline(roomId) })
              }
              ws.close()
              return
            }
            ws.send(JSON.stringify({ type: 'ping' }))
          }
        }, 30_000)

        // Catch up missed messages on reconnect
        catchUp()
      }

      ws.onmessage = e => {
        // Heartbeat pong — update timestamp, skip event processing
        if (e.data === '{"type":"pong"}') {
          lastPongRef.current = Date.now()
          if (zombieCheckRef.current) {
            clearTimeout(zombieCheckRef.current)
            zombieCheckRef.current = null
          }
          return
        }

        const event = parseWsEvent(e.data)
        if (!event) return

        if (event.type === 'team_info') {
          if (roomId) {
            void queryClient.cancelQueries({ queryKey: queryKeys.rooms.teamInfo(roomId) })
            const prev = queryClient.getQueryData<TeamInfoResponse>(
              queryKeys.rooms.teamInfo(roomId)
            )
            queryClient.setQueryData<TeamInfoResponse>(queryKeys.rooms.teamInfo(roomId), event)
            if (prev) {
              const prevNames = new Set(prev.members.map(m => m.name))
              for (const m of event.members) {
                if (!prevNames.has(m.name) && m.status === 'active') {
                  toast.success(m.name, { description: 'Ready to work', duration: 5000 })
                }
              }
              for (const m of event.members) {
                const old = prev.members.find(p => p.name === m.name)
                if (old && old.status === 'active' && m.status === 'inactive') {
                  toast(m.name, { description: 'Signed off', icon: '\uD83D\uDC4B', duration: 5000 })
                }
              }
            }
          }
          return
        }

        // ── Zustand-managed state ────────────────────────────────────
        if (event.type === 'commands_info') {
          if (roomId) setCommands(roomId, event.commands)
          return
        }
        if (event.type === 'plan_decision') {
          if (roomId) {
            setPlanDecision(roomId, event.plan_review_id, {
              status: event.status,
              feedback: event.feedback ?? undefined,
              permissionMode: event.permission_mode,
            })
          }
          return
        }
        if (event.type === 'question_answer') {
          if (roomId) {
            setQuestionAnswer(roomId, event.question_review_id, {
              status: event.status,
              answers: event.answers,
            })
          }
          return
        }
        if (event.type === 'permission_decision') {
          if (roomId) {
            setPermissionDecision(roomId, event.permission_review_id, {
              status: event.status,
              feedback: event.feedback ?? undefined,
            })
          }
          return
        }

        // ── TanStack Query–managed state (genuine server data) ───────
        if (event.type === 'tasks_info') {
          if (roomId) {
            void queryClient.cancelQueries({ queryKey: queryKeys.rooms.tasks(roomId) })
            queryClient.setQueryData(queryKeys.rooms.tasks(roomId), event)
          }
          return
        }
        if (event.type === 'terminal_data') {
          onTerminalDataRef.current?.(event.data)
          return
        }
        // Fallback: chat message or log
        if (!event.sender || !event.content) return
        if (event.seq != null) {
          if (event.type === 'log') {
            if (event.seq > lastLogSeqRef.current) {
              lastLogSeqRef.current = event.seq
            }
          } else if (event.seq > lastSeqRef.current) {
            lastSeqRef.current = event.seq
          }
        }

        // Write to timeline cache
        if (roomId) {
          void queryClient.cancelQueries({ queryKey: queryKeys.rooms.timeline(roomId) })
          queryClient.setQueryData<TimelineItem[]>(queryKeys.rooms.timeline(roomId), old => {
            const item = { ...event, status: 'sent' as const }
            if (!old) return [item]
            return reconcileOptimistic(old, item)
          })
        }

        // Side effects (notifications, haptics, unread count)
        onMessageRef.current?.(event)
      }

      ws.onerror = error => console.error('WebSocket error', error)
      ws.onclose = () => {
        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current)
          heartbeatRef.current = null
        }
        setConnected(false)
        const delay = backoffRef.current
        backoffRef.current = Math.min(delay * 2, MAX_BACKOFF)
        setTimeout(() => {
          if (wsRef.current === ws) connect()
        }, delay)
      }

      wsRef.current = ws
    }

    connect()

    const onResume = () => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        // WS is closed — reconnect immediately
        backoffRef.current = MIN_BACKOFF
        connect()
        if (roomId) {
          queryClient.invalidateQueries({ queryKey: queryKeys.rooms.timeline(roomId) })
        }
      } else {
        // WS looks open — send ping + catchUp, but verify it's not zombie
        wsRef.current.send(JSON.stringify({ type: 'ping' }))
        catchUp()

        if (zombieCheckRef.current) clearTimeout(zombieCheckRef.current)
        const beforePing = Date.now()
        zombieCheckRef.current = setTimeout(() => {
          if (lastPongRef.current < beforePing) {
            // No pong received since our ping — zombie connection
            if (wsRef.current) wsRef.current.close()
            backoffRef.current = MIN_BACKOFF
            connect()
            if (roomId) {
              queryClient.invalidateQueries({ queryKey: queryKeys.rooms.timeline(roomId) })
            }
          }
        }, 3000)
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') onResume()
    }

    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) onResume()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('online', onResume)
    window.addEventListener('focus', onResume)
    window.addEventListener('pageshow', onPageShow)

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('online', onResume)
      window.removeEventListener('focus', onResume)
      window.removeEventListener('pageshow', onPageShow)
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current)
        heartbeatRef.current = null
      }
      if (zombieCheckRef.current) {
        clearTimeout(zombieCheckRef.current)
        zombieCheckRef.current = null
      }
      if (wsRef.current) {
        const ws = wsRef.current
        wsRef.current = null
        ws.close()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs are stable, .current should not be deps
  }, [roomId, apiKey])

  function sendTerminalSubscribe(paneId: string) {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'terminal_subscribe', paneId }))
    } else {
      console.warn('[terminal] WebSocket not open, readyState:', wsRef.current?.readyState)
    }
  }

  function sendTerminalUnsubscribe() {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'terminal_unsubscribe' }))
    }
  }

  function sendTerminalResize(cols: number) {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'terminal_resize', cols }))
    }
  }

  return { connected, sendTerminalSubscribe, sendTerminalUnsubscribe, sendTerminalResize }
}
