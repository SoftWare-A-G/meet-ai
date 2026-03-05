import { useEffect, useRef, useState } from 'react'
import { loadMessagesSinceSeq } from '../lib/api'
import type { Message, TeamInfo, TasksInfo, CommandInfo, CommandsInfo } from '../lib/types'

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

type UseRoomWebSocketOptions = {
  onTeamInfo?: (info: TeamInfo) => void
  onCommandsInfo?: (commands: CommandInfo[]) => void
  onPlanDecision?: (event: PlanDecisionEvent) => void
  onQuestionAnswer?: (event: QuestionAnswerEvent) => void
  onPermissionDecision?: (event: PermissionDecisionEvent) => void
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
  const onTeamInfoRef = useRef(options?.onTeamInfo)
  onTeamInfoRef.current = options?.onTeamInfo
  const onCommandsInfoRef = useRef(options?.onCommandsInfo)
  onCommandsInfoRef.current = options?.onCommandsInfo
  const onPlanDecisionRef = useRef(options?.onPlanDecision)
  onPlanDecisionRef.current = options?.onPlanDecision
  const onQuestionAnswerRef = useRef(options?.onQuestionAnswer)
  onQuestionAnswerRef.current = options?.onQuestionAnswer
  const onPermissionDecisionRef = useRef(options?.onPermissionDecision)
  onPermissionDecisionRef.current = options?.onPermissionDecision
  const onTerminalDataRef = useRef(options?.onTerminalData)
  onTerminalDataRef.current = options?.onTerminalData
  const lastSeqRef = useRef<number>(0) as { current: number }
  const backoffRef = useRef<number>(MIN_BACKOFF) as { current: number }
  const [connected, setConnected] = useState(true)
  const [tasksInfo, setTasksInfo] = useState<TasksInfo | null>(null)

  useEffect(() => {
    if (!roomId || !apiKey) return

    async function catchUp() {
      if (!roomId || lastSeqRef.current === 0) return
      try {
        const missed = await loadMessagesSinceSeq(roomId, lastSeqRef.current)
        for (const msg of missed) {
          if (msg.seq && msg.seq > lastSeqRef.current) {
            lastSeqRef.current = msg.seq
          }
          onMessageRef.current?.(msg)
        }
      } catch {
        /* ignore catch-up errors */
      }
    }

    function connect() {
      if (wsRef.current) wsRef.current.close()
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
      const tokenParam = `?token=${encodeURIComponent(apiKey as string)}`
      const ws = new WebSocket(`${protocol}//${location.host}/api/rooms/${roomId}/ws${tokenParam}`)

      ws.onopen = () => {
        setConnected(true)
        backoffRef.current = MIN_BACKOFF
        // Catch up missed messages on reconnect
        catchUp()
      }

      ws.onmessage = e => {
        try {
          const data = JSON.parse(e.data)
          if (data.type === 'team_info') {
            onTeamInfoRef.current?.(data as TeamInfo)
            return
          }
          if (data.type === 'commands_info') {
            onCommandsInfoRef.current?.((data as CommandsInfo).commands)
            return
          }
          if (data.type === 'tasks_info') {
            setTasksInfo(data as TasksInfo)
            return
          }
          if (data.type === 'plan_decision') {
            onPlanDecisionRef.current?.(data as PlanDecisionEvent)
            return
          }
          if (data.type === 'question_answer') {
            onQuestionAnswerRef.current?.(data as QuestionAnswerEvent)
            return
          }
          if (data.type === 'permission_decision') {
            onPermissionDecisionRef.current?.(data as PermissionDecisionEvent)
            return
          }
          if (data.type === 'terminal_data' && typeof data.data === 'string') {
            onTerminalDataRef.current?.(data.data)
            return
          }
          const msg = data as Message
          if (!msg.sender || !msg.content) return
          if (msg.seq && msg.seq > lastSeqRef.current) {
            lastSeqRef.current = msg.seq
          }
          onMessageRef.current?.(msg)
        } catch {
          /* ignore malformed */
        }
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

  return { wsRef, connected, tasksInfo, sendTerminalSubscribe, sendTerminalUnsubscribe }
}
