import { useEffect, useCallback } from 'hono/jsx/dom'
import type { Room } from '../lib/types'

export function getRoomIdFromUrl(): string | null {
  const match = location.pathname.match(/^\/chat\/([a-f0-9-]+)$/i)
  return match ? match[1] : null
}

export function useUrlRouting(
  rooms: Room[],
  onSelectRoom: (roomId: string | null) => void,
) {
  useEffect(() => {
    const handler = () => {
      const roomId = getRoomIdFromUrl()
      onSelectRoom(roomId)
    }
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [rooms, onSelectRoom])

  const pushRoom = useCallback((roomId: string) => {
    history.pushState({ roomId }, '', '/chat/' + roomId)
  }, [])

  const replaceUrl = useCallback((path: string) => {
    history.replaceState(null, '', path)
  }, [])

  return { pushRoom, replaceUrl }
}
