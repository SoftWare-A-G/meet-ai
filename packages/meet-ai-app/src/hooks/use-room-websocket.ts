import { useEffect, useRef, useState } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { wsUrl, loadMessagesSinceSeq } from '@/lib/api'
import type { Message, TeamInfo } from '@/lib/types'

const MIN_BACKOFF = 1000
const MAX_BACKOFF = 30000

export function useRoomWebSocket(
  roomId: string | null,
  apiKey: string | null,
  onMessage: (msg: Message) => void,
) {
  const wsRef = useRef<WebSocket | null>(null)
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage
  const lastSeqRef = useRef<number>(0)
  const backoffRef = useRef<number>(MIN_BACKOFF)
  const [connected, setConnected] = useState(true)
  const [teamInfo, setTeamInfo] = useState<TeamInfo | null>(null)

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
          onMessageRef.current(msg)
        }
      } catch { /* ignore */ }
    }

    function connect() {
      if (wsRef.current) wsRef.current.close()
      const ws = new WebSocket(wsUrl(`/api/rooms/${roomId}/ws`, apiKey!))

      ws.onopen = () => {
        setConnected(true)
        backoffRef.current = MIN_BACKOFF
        catchUp()
      }

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data)
          if (data.type === 'team_info') {
            setTeamInfo(data as TeamInfo)
            return
          }
          const msg = data as Message
          if (!msg.sender || !msg.content) return
          if (msg.seq && msg.seq > lastSeqRef.current) {
            lastSeqRef.current = msg.seq
          }
          onMessageRef.current(msg)
        } catch { /* ignore */ }
      }

      ws.onerror = () => {
        console.error('WebSocket error')
        if (wsRef.current === ws) setConnected(false)
      }
      ws.onclose = () => {
        const delay = backoffRef.current
        backoffRef.current = Math.min(delay * 2, MAX_BACKOFF)
        if (wsRef.current === ws) {
          setConnected(false)
          setTimeout(() => connect(), delay)
        }
      }

      wsRef.current = ws
    }

    connect()

    function handleAppState(state: AppStateStatus) {
      if (state === 'active') {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          backoffRef.current = MIN_BACKOFF
          connect()
        } else {
          catchUp()
        }
      }
    }

    const subscription = AppState.addEventListener('change', handleAppState)

    return () => {
      subscription.remove()
      setConnected(false)
      if (wsRef.current) {
        const ws = wsRef.current
        wsRef.current = null
        ws.close()
      }
    }
  }, [roomId, apiKey])

  return { connected, teamInfo }
}
