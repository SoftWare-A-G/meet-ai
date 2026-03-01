import { useEffect, useRef, useCallback } from 'react'

type LobbyEvent =
  | { type: 'room_created'; id: string; name: string }
  | { type: 'room_deleted'; id: string }

export function useLobbyWebSocket(
  apiKey: string | null,
  onRoomCreated: (id: string, name: string) => void
) {
  const wsRef = useRef<WebSocket | null>(null)
  const onRoomCreatedRef = useRef(onRoomCreated)
  onRoomCreatedRef.current = onRoomCreated

  useEffect(() => {
    if (!apiKey) return

    function connect() {
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
      const tokenParam = `?token=${encodeURIComponent(apiKey as string)}`
      const ws = new WebSocket(`${protocol}//${location.host}/api/lobby/ws${tokenParam}`)

      ws.onmessage = e => {
        try {
          const evt = JSON.parse(e.data) as LobbyEvent
          if (evt.type === 'room_created') {
            onRoomCreatedRef.current?.(evt.id, evt.name)
          }
        } catch {
          /* ignore */
        }
      }

      ws.onclose = () => {
        setTimeout(() => {
          if (wsRef.current === ws) connect()
        }, 3000)
      }

      wsRef.current = ws
    }

    connect()

    return () => {
      if (wsRef.current) {
        const ws = wsRef.current
        wsRef.current = null
        ws.close()
      }
    }
  }, [apiKey])

  const send = useCallback((data: object) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data))
    }
  }, [])

  return { send }
}
