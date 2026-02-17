import { useState, useEffect, useCallback } from 'react'
import MessageList from '../MessageList'
import ChatInput from '../ChatInput'
import { useRoomWebSocket } from '../../hooks/useRoomWebSocket'
import { useOfflineQueue } from '../../hooks/useOfflineQueue'
import * as api from '../../lib/api'
import { requestPermission, notifyIfHidden } from '../../lib/notifications'
import { parseUtcDate } from '../../lib/dates'
import type { Message as MessageType, Room, TeamInfo, TasksInfo } from '../../lib/types'

type DisplayMessage = MessageType & {
  tempId?: string
  status?: 'sent' | 'pending' | 'failed'
}

type ChatViewProps = {
  room: Room
  apiKey: string
  userName: string
  onTeamInfo?: (info: TeamInfo | null) => void
  onTasksInfo?: (info: TasksInfo | null) => void
}

export default function ChatView({ room, apiKey, userName, onTeamInfo, onTasksInfo }: ChatViewProps) {
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>({})
  const [unreadCount, setUnreadCount] = useState(0)
  const [forceScrollCounter, setForceScrollCounter] = useState(0)
  const [voiceAvailable, setVoiceAvailable] = useState(false)
  const { queue, remove, getForRoom } = useOfflineQueue()

  // Check TTS availability once on mount
  useEffect(() => {
    api.checkTtsAvailable().then(setVoiceAvailable)
  }, [])

  // Load message history + logs + attachment counts
  useEffect(() => {
    let cancelled = false
    async function load() {
      const [history, logs, counts] = await Promise.all([
        api.loadMessages(room.id),
        api.loadLogs(room.id),
        api.loadAttachmentCounts(room.id),
      ])
      if (cancelled) return
      const all = [...history, ...logs].sort(
        (a, b) => parseUtcDate(a.created_at).valueOf() - parseUtcDate(b.created_at).valueOf()
      )
      setMessages(all.map(m => ({ ...m, status: 'sent' as const })))
      setAttachmentCounts(counts)

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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- getForRoom/remove are stable callbacks
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
          updated[pendingIdx] = { ...msg, tempId: prev[pendingIdx].tempId, status: 'sent' as const }
          return updated
        }
        return [...prev, { ...msg, status: 'sent' as const }]
      })
    } else {
      setMessages(prev => [...prev, { ...msg, status: 'sent' as const }])
      if (msg.type !== 'log' && msg.sender !== 'hook') {
        setUnreadCount(c => c + 1)
      }
    }
  }, [userName])

  const onTeamInfoWs = useCallback((info: TeamInfo) => {
    onTeamInfo?.(info)
  }, [onTeamInfo])

  const { connected, tasksInfo } = useRoomWebSocket(room.id, apiKey, onWsMessage, { onTeamInfo: onTeamInfoWs })

  useEffect(() => {
    onTasksInfo?.(tasksInfo)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- onTasksInfo is stable
  }, [tasksInfo])

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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- getForRoom/remove are stable callbacks
  }, [room.id])

  const handleUploadFile = useCallback(async (file: File) => api.uploadFile(room.id, file), [room.id])

  const handleSend = useCallback(async (content: string, attachmentIds: string[] = []) => {
    const tempId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    setMessages(prev => [...prev, {
      sender: userName,
      content,
      created_at: new Date().toISOString(),
      tempId,
      status: 'pending' as const,
    }])
    setForceScrollCounter(c => c + 1)

    try {
      const result = await api.sendMessage(room.id, userName, content, attachmentIds.length > 0 ? attachmentIds : undefined)
      setMessages(prev => prev.map(m =>
        m.tempId === tempId ? { ...m, status: 'sent' as const } : m
      ))

      if (attachmentIds.length > 0 && result.id) {
        setAttachmentCounts(prev => ({
          ...prev,
          [result.id]: attachmentIds.length,
        }))
      }
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
      <MessageList
        messages={messages}
        attachmentCounts={attachmentCounts}
        unreadCount={unreadCount}
        forceScrollCounter={forceScrollCounter}
        onScrollToBottom={() => setUnreadCount(0)}
        onRetry={handleRetry}
        connected={connected}
        voiceAvailable={voiceAvailable}
      />
      <ChatInput
        roomName={room.name}
        onSend={handleSend}
        onUploadFile={handleUploadFile}
      />
    </>
  )
}
