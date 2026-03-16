import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { fetchMessagesSinceSeq } from '../lib/fetchers'
import { queryKeys } from '../lib/query-keys'
import { useRoomStore } from '../stores/useRoomStore'
import { mergeIntoTimeline, reconcileOptimistic } from './useRoomTimeline'
import type { TimelineItem } from './useRoomTimeline'
import type { CommandsInfo, TaskItem, TeamInfoResponse } from '../lib/fetchers'
import type { Message, TerminalDataEvent } from '../lib/types'

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
  const backoffRef = useRef(MIN_BACKOFF)
  const [connected, setConnected] = useState(true)

  useEffect(() => {
    if (!roomId || !apiKey) return
    const key = apiKey

    // Grab Zustand actions once (stable references, no re-render deps)
    const { setCommands, setPlanDecision, setQuestionAnswer, setPermissionDecision } =
      useRoomStore.getState()

    async function catchUp() {
      if (!roomId || lastSeqRef.current === 0) return
      try {
        const missed = await fetchMessagesSinceSeq(roomId, lastSeqRef.current)
        if (missed.length === 0) return

        // Update lastSeqRef
        for (const msg of missed) {
          if (msg.seq != null && msg.seq > lastSeqRef.current) {
            lastSeqRef.current = msg.seq
          }
        }

        // Merge into timeline cache
        void queryClient.cancelQueries({ queryKey: queryKeys.rooms.timeline(roomId) })
        queryClient.setQueryData<TimelineItem[]>(
          queryKeys.rooms.timeline(roomId),
          old => {
            const tagged = missed.map(m => ({ ...m, status: 'sent' as const }))
            if (!old) return tagged
            return mergeIntoTimeline(old, tagged)
          },
        )

        // Side effects for missed messages
        for (const msg of missed) {
          onMessageRef.current?.(msg)
        }
      } catch {
        /* ignore catch-up errors */
      }
    }

    function connect() {
      if (wsRef.current) wsRef.current.close()
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
      const tokenParam = `?token=${encodeURIComponent(key)}`
      const ws = new WebSocket(`${protocol}//${location.host}/api/rooms/${roomId}/ws${tokenParam}`)

      ws.onopen = () => {
        setConnected(true)
        backoffRef.current = MIN_BACKOFF
        // Catch up missed messages on reconnect
        catchUp()
      }

      ws.onmessage = e => {
        const event = parseWsEvent(e.data)
        if (!event) return

        if (event.type === 'team_info') {
          if (roomId) {
            void queryClient.cancelQueries({ queryKey: queryKeys.rooms.teamInfo(roomId) })
            const prev = queryClient.getQueryData<TeamInfoResponse>(queryKeys.rooms.teamInfo(roomId))
            const { type: _, ...teamInfo } = event
            queryClient.setQueryData<TeamInfoResponse>(queryKeys.rooms.teamInfo(roomId), teamInfo)
            if (prev) {
              const prevNames = new Set(prev.members.map(m => m.name))
              for (const m of teamInfo.members) {
                if (!prevNames.has(m.name) && m.status === 'active') {
                  toast.success(m.name, { description: 'Ready to work', duration: 5000 })
                }
              }
              for (const m of teamInfo.members) {
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
        if (event.seq && event.seq > lastSeqRef.current) {
          lastSeqRef.current = event.seq
        }

        // Write to timeline cache
        if (roomId) {
          void queryClient.cancelQueries({ queryKey: queryKeys.rooms.timeline(roomId) })
          queryClient.setQueryData<TimelineItem[]>(
            queryKeys.rooms.timeline(roomId),
            old => {
              const item = { ...event, status: 'sent' as const }
              if (!old) return [item]
              return reconcileOptimistic(old, item)
            },
          )
        }

        // Side effects (notifications, haptics, unread count)
        onMessageRef.current?.(event)
      }

      ws.onerror = error => console.error('WebSocket error', error)
      ws.onclose = () => {
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

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          // WS is closed — reconnect immediately
          backoffRef.current = MIN_BACKOFF
          connect()
        } else {
          // WS is open but may have missed frames while backgrounded
          catchUp()
        }
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
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
