import { useEffect, useRef, useState } from 'react'
import { loadMessagesSinceSeq } from '../lib/api'
import type { Message, TeamInfo, TasksInfo } from '../lib/types'

type UseRoomWebSocketOptions = {
  onTeamInfo?: (info: TeamInfo) => void
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
          if (data.type === 'tasks_info') {
            setTasksInfo(data as TasksInfo)
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
  }, [roomId, apiKey])

  return { wsRef, connected, tasksInfo }
}
