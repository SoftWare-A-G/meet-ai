import { useEffect, useRef } from 'hono/jsx/dom'
import type { Message, TeamInfo } from '../lib/types'

type UseRoomWebSocketOptions = {
  onTeamInfo?: (info: TeamInfo) => void
}

export function useRoomWebSocket(
  roomId: string | null,
  apiKey: string | null,
  onMessage: (msg: Message) => void,
  options?: UseRoomWebSocketOptions,
) {
  const wsRef = useRef<WebSocket | null>(null)
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage
  const onTeamInfoRef = useRef(options?.onTeamInfo)
  onTeamInfoRef.current = options?.onTeamInfo

  useEffect(() => {
    if (!roomId || !apiKey) return

    function connect() {
      if (wsRef.current) wsRef.current.close()
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
      const tokenParam = `?token=${encodeURIComponent(apiKey as string)}`
      const ws = new WebSocket(`${protocol}//${location.host}/api/rooms/${roomId}/ws${tokenParam}`)

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data)
          if (data.type === 'team_info') {
            onTeamInfoRef.current?.(data as TeamInfo)
            return
          }
          const msg = data as Message
          if (!msg.sender || !msg.content) return
          onMessageRef.current?.(msg)
        } catch { /* ignore malformed */ }
      }

      ws.onerror = () => console.error('WebSocket error')
      ws.onclose = () => {
        setTimeout(() => {
          if (wsRef.current === ws) connect()
        }, 2000)
      }

      wsRef.current = ws
    }

    connect()

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          connect()
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

  return wsRef
}
