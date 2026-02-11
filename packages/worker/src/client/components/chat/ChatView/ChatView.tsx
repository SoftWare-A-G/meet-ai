import { useState, useEffect, useCallback } from 'hono/jsx/dom'
import MessageList from '../MessageList'
import ChatInput from '../ChatInput'
import { useRoomWebSocket } from '../../../hooks/useRoomWebSocket'
import { useOfflineQueue } from '../../../hooks/useOfflineQueue'
import * as api from '../../../lib/api'
import { requestPermission, notifyIfHidden } from '../../../lib/notifications'
import type { Message as MessageType, Room, TeamInfo } from '../../../lib/types'

type DisplayMessage = MessageType & {
  tempId?: string
  status?: 'sent' | 'pending' | 'failed'
}

type ChatViewProps = {
  room: Room
  apiKey: string
  userName: string
  onTeamInfo?: (info: TeamInfo | null) => void
}

export default function ChatView({ room, apiKey, userName, onTeamInfo }: ChatViewProps) {
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const { queue, remove, getForRoom } = useOfflineQueue()

  // Load message history + logs
  useEffect(() => {
    let cancelled = false
    async function load() {
      const [history, logs] = await Promise.all([
        api.loadMessages(room.id),
        api.loadLogs(room.id),
      ])
      if (cancelled) return
      const all = [...history, ...logs].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
      setMessages(all.map(m => ({ ...m, status: 'sent' as const })))

      // Restore queued offline messages
      try {
        const queued = await getForRoom(room.id)
        if (cancelled || queued.length === 0) return
        setMessages(prev => [
          ...prev,
          ...queued.map(q => ({
            sender: q.sender,
            content: q.content,
            created_at: new Date(q.timestamp).toISOString(),
            tempId: q.tempId,
            status: 'failed' as const,
          })),
        ])
        // Auto-flush if online
        if (navigator.onLine) {
          for (const msg of queued) {
            try {
              await api.sendMessage(msg.roomId, msg.sender, msg.content)
              await remove(msg.tempId)
              if (!cancelled) {
                setMessages(prev => prev.map(m =>
                  m.tempId === msg.tempId ? { ...m, status: 'sent' as const } : m
                ))
              }
            } catch {
              // leave as failed
            }
          }
        }
      } catch { /* ignore */ }
    }
    load()
    return () => { cancelled = true }
  }, [room.id])

  // Request notification permission once on mount
  useEffect(() => { requestPermission() }, [])

  // WebSocket for real-time messages
  const onWsMessage = useCallback((msg: MessageType) => {
    notifyIfHidden(msg, userName)

    // Deduplicate own echoed messages
    if (msg.sender === userName) {
      setMessages(prev => {
        const pendingIdx = prev.findIndex(m => m.tempId && m.content === msg.content)
        if (pendingIdx !== -1) {
          const updated = [...prev]
          updated.splice(pendingIdx, 1)
          return [...updated, { ...msg, status: 'sent' as const }]
        }
        return [...prev, { ...msg, status: 'sent' as const }]
      })
    } else {
      setMessages(prev => [...prev, { ...msg, status: 'sent' as const }])
      setUnreadCount(c => c + 1)
    }
  }, [userName])

  const onTeamInfoWs = useCallback((info: TeamInfo) => {
    onTeamInfo?.(info)
  }, [onTeamInfo])

  const { connected } = useRoomWebSocket(room.id, apiKey, onWsMessage, { onTeamInfo: onTeamInfoWs })

  // Flush queue on coming online
  useEffect(() => {
    const handler = async () => {
      try {
        const queued = await getForRoom(room.id)
        for (const msg of queued) {
          setMessages(prev => prev.map(m =>
            m.tempId === msg.tempId ? { ...m, status: 'pending' as const } : m
          ))
          try {
            await api.sendMessage(msg.roomId, msg.sender, msg.content)
            await remove(msg.tempId)
            setMessages(prev => prev.map(m =>
              m.tempId === msg.tempId ? { ...m, status: 'sent' as const } : m
            ))
          } catch {
            setMessages(prev => prev.map(m =>
              m.tempId === msg.tempId ? { ...m, status: 'failed' as const } : m
            ))
          }
        }
      } catch { /* ignore */ }
    }
    window.addEventListener('online', handler)
    return () => window.removeEventListener('online', handler)
  }, [room.id])

  const handleSend = useCallback(async (content: string) => {
    const tempId = 'pending-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6)
    setMessages(prev => [...prev, {
      sender: userName,
      content,
      created_at: new Date().toISOString(),
      tempId,
      status: 'pending' as const,
    }])

    try {
      await api.sendMessage(room.id, userName, content)
      setMessages(prev => prev.map(m =>
        m.tempId === tempId ? { ...m, status: 'sent' as const } : m
      ))
    } catch {
      await queue({ tempId, roomId: room.id, sender: userName, content, apiKey, timestamp: Date.now() })
      setMessages(prev => prev.map(m =>
        m.tempId === tempId ? { ...m, status: 'failed' as const } : m
      ))
    }
  }, [room.id, userName, apiKey])

  const handleRetry = useCallback(async (tempId: string) => {
    const msg = messages.find(m => m.tempId === tempId)
    if (!msg) return
    setMessages(prev => prev.map(m =>
      m.tempId === tempId ? { ...m, status: 'pending' as const } : m
    ))
    try {
      await api.sendMessage(room.id, userName, msg.content)
      setMessages(prev => prev.map(m =>
        m.tempId === tempId ? { ...m, status: 'sent' as const } : m
      ))
      await remove(tempId)
    } catch {
      setMessages(prev => prev.map(m =>
        m.tempId === tempId ? { ...m, status: 'failed' as const } : m
      ))
    }
  }, [room.id, userName, messages])

  return (
    <>
      {!connected && (
        <div class="reconnecting-bar">Reconnecting...</div>
      )}
      <MessageList
        messages={messages}
        unreadCount={unreadCount}
        onScrollToBottom={() => setUnreadCount(0)}
        onRetry={handleRetry}
      />
      <ChatInput roomName={room.name} onSend={handleSend} />
    </>
  )
}
