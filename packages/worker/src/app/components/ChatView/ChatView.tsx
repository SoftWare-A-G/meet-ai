import { useState, useEffect, useCallback } from 'react'
import { useAgentActivity } from '../../hooks/useAgentActivity'
import { useAttachmentCountsQuery } from '../../hooks/useAttachmentCountsQuery'
import { useHaptics } from '../../hooks/useHaptics'
import { useOfflineQueue } from '../../hooks/useOfflineQueue'
import { useRoomTimeline, useTimelineUpdater } from '../../hooks/useRoomTimeline'
import { useRoomWebSocket } from '../../hooks/useRoomWebSocket'
import { useUploadFile } from '../../hooks/useUploadFile'
import * as api from '../../lib/api'
import { requestPermission, notifyIfHidden } from '../../lib/notifications'
import ActivityBar from '../ActivityBar'
import ActivityLogDrawer from '../ActivityLogDrawer'
import ChatInput from '../ChatInput'
import MessageList from '../MessageList'
import TerminalViewerModal from '../TerminalViewerModal'
import type { AgentActivity } from '../../lib/activity'
import type {
  Message as MessageType,
  Room,
} from '../../lib/types'

type ChatViewProps = {
  room: Room
  apiKey: string
  userName: string
  onAgentActivity?: (activity: Map<string, AgentActivity>) => void
  terminalOpen?: boolean
  onTerminalClose?: () => void
}

export default function ChatView({
  room,
  apiKey,
  userName,
  onAgentActivity,
  terminalOpen = false,
  onTerminalClose,
}: ChatViewProps) {
  const { data: attachmentCounts } = useAttachmentCountsQuery(room.id)
  const { data: timeline = [] } = useRoomTimeline(room.id)
  const { appendOptimistic, updateItemStatus, appendItems } = useTimelineUpdater(room.id)
  const uploadFileMutation = useUploadFile()
  const [activityDrawerOpen, setActivityDrawerOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [forceScrollCounter, setForceScrollCounter] = useState(0)
  const [voiceAvailable, setVoiceAvailable] = useState(false)
  const [terminalData, setTerminalData] = useState<string | null>(null)
  const { queue, remove, getForRoom } = useOfflineQueue()
  const { triggerForMessage } = useHaptics()

  // Check TTS availability once on mount
  useEffect(() => {
    api.checkTtsAvailable().then(setVoiceAvailable)
  }, [])

  // Request notification permission once on mount
  useEffect(() => {
    requestPermission()
  }, [])

  // Restore offline queue and auto-flush
  useEffect(() => {
    let cancelled = false
    async function restore() {
      try {
        const queued = await getForRoom(room.id)
        if (cancelled || queued.length === 0) return
        appendItems(
          queued.map(q => ({
            sender: q.sender,
            content: q.content,
            created_at: new Date(q.timestamp).toISOString(),
            tempId: q.tempId,
            status: 'failed' as const,
          })),
        )
        // Auto-flush if online
        if (navigator.onLine) {
          for (const msg of queued) {
            try {
              await api.sendMessage(msg.roomId, msg.sender, msg.content)
              await remove(msg.tempId)
              if (!cancelled) {
                updateItemStatus(msg.tempId, 'sent')
              }
            } catch {
              // leave as failed
            }
          }
        }
      } catch {
        /* ignore */
      }
    }
    restore()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- getForRoom/remove/appendItems/updateItemStatus are stable
  }, [room.id])

  // WebSocket — simplified callback for side effects only
  // (cache updates are handled in useRoomWebSocket)
  const onWsMessage = useCallback(
    (msg: MessageType) => {
      notifyIfHidden(msg, userName)
      if (msg.type !== 'log' && msg.sender !== 'hook' && msg.sender !== userName) {
        setUnreadCount(c => c + 1)
        triggerForMessage(msg)
      }
    },
    [userName, triggerForMessage],
  )

  const onTerminalDataWs = useCallback((data: string) => {
    setTerminalData(data)
  }, [])

  const {
    connected,
    sendTerminalSubscribe,
    sendTerminalUnsubscribe,
    sendTerminalResize,
  } = useRoomWebSocket(room.id, apiKey, onWsMessage, {
    onTerminalData: onTerminalDataWs,
  })

  useEffect(() => {
    if (terminalOpen && connected) {
      sendTerminalSubscribe('default')
    } else if (!terminalOpen) {
      sendTerminalUnsubscribe()
      setTerminalData(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sendTerminal* are stable functions
  }, [terminalOpen, connected])

  // Derive per-agent activity from timeline
  const agentActivity = useAgentActivity(timeline, room.id)

  useEffect(() => {
    onAgentActivity?.(agentActivity)
  }, [agentActivity, onAgentActivity])

  // Flush queue on coming online
  useEffect(() => {
    const handler = async () => {
      try {
        const queued = await getForRoom(room.id)
        for (const msg of queued) {
          updateItemStatus(msg.tempId, 'pending')
          try {
            await api.sendMessage(msg.roomId, msg.sender, msg.content)
            await remove(msg.tempId)
            updateItemStatus(msg.tempId, 'sent')
          } catch {
            updateItemStatus(msg.tempId, 'failed')
          }
        }
      } catch {
        /* ignore */
      }
    }
    window.addEventListener('online', handler)
    return () => window.removeEventListener('online', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- getForRoom/remove/updateItemStatus are stable
  }, [room.id])

  const handleUploadFile = useCallback(
    (file: File) => uploadFileMutation.mutateAsync({ roomId: room.id, file }),
    [room.id, uploadFileMutation],
  )

  const handleSend = useCallback(
    async (content: string, attachmentIds: string[] = []) => {
      const tempId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      appendOptimistic({
        sender: userName,
        content,
        created_at: new Date().toISOString(),
        tempId,
        status: 'pending',
      })
      setForceScrollCounter(c => c + 1)

      try {
        await api.sendMessage(room.id, userName, content, attachmentIds.length > 0 ? attachmentIds : undefined)
        // WS echo will reconcile the optimistic item via reconcileOptimistic
      } catch {
        await queue({
          tempId,
          roomId: room.id,
          sender: userName,
          content,
          apiKey,
          timestamp: Date.now(),
        })
        updateItemStatus(tempId, 'failed')
      }
    },
    [room.id, userName, apiKey, queue, appendOptimistic, updateItemStatus],
  )

  const handleRetry = useCallback(
    async (tempId: string) => {
      const msg = timeline.find(m => m.tempId === tempId)
      if (!msg) return
      updateItemStatus(tempId, 'pending')
      try {
        await api.sendMessage(room.id, userName, msg.content)
        updateItemStatus(tempId, 'sent')
        await remove(tempId)
      } catch {
        updateItemStatus(tempId, 'failed')
      }
    },
    [room.id, userName, timeline, remove, updateItemStatus],
  )

  return (
    <>
      <TerminalViewerModal
        open={terminalOpen}
        onClose={() => onTerminalClose?.()}
        data={terminalData}
        onResize={sendTerminalResize}
      />
      <MessageList
        messages={timeline}
        attachmentCounts={attachmentCounts}
        roomId={room.id}
        userName={userName}
        unreadCount={unreadCount}
        forceScrollCounter={forceScrollCounter}
        onScrollToBottom={() => setUnreadCount(0)}
        onRetry={handleRetry}
        onSend={handleSend}
        connected={connected}
        voiceAvailable={voiceAvailable}
      />
      <ActivityBar onClick={() => setActivityDrawerOpen(true)} />
      <ActivityLogDrawer
        open={activityDrawerOpen}
        onOpenChange={setActivityDrawerOpen}
        messages={timeline}
      />
      <ChatInput roomName={room.name} onSend={handleSend} onUploadFile={handleUploadFile} />
    </>
  )
}
