import { useState, useEffect, useCallback } from 'react'
import { useAttachmentCountsQuery } from '../../hooks/useAttachmentCountsQuery'
import { useHaptics } from '../../hooks/useHaptics'
import { useRoomTimeline, useTimelineUpdater } from '../../hooks/useRoomTimeline'
import { useRoomWebSocket } from '../../hooks/useRoomWebSocket'
import { useSendMessage } from '../../hooks/useSendMessage'
import { useTtsStatus } from '../../hooks/useTtsQuery'
import { useUploadFile } from '../../hooks/useUploadFile'
import { requestPermission, notifyIfHidden } from '../../lib/notifications'
import { offlineQueue } from '../../lib/offline-queue'
import ActivityBar from '../ActivityBar'
import ActivityLogDrawer from '../ActivityLogDrawer'
import ChatInput from '../ChatInput'
import MessageList from '../MessageList'
import TerminalViewerModal from '../TerminalViewerModal'
import type { Message as MessageType } from '../../lib/types'

type ChatViewProps = {
  roomId: string
  apiKey: string
  userName: string
  terminalOpen?: boolean
  onTerminalClose?: () => void
}

export default function ChatView({
  roomId,
  apiKey,
  userName,
  terminalOpen = false,
  onTerminalClose,
}: ChatViewProps) {
  const { data: attachmentCounts } = useAttachmentCountsQuery(roomId)
  const {
    data: timeline = [],
    isLoading: timelineLoading,
    error: timelineError,
  } = useRoomTimeline(roomId)
  const { appendItems } = useTimelineUpdater(roomId)
  const { send: handleSend, retry: handleRetry } = useSendMessage(roomId, userName, apiKey)
  const uploadFileMutation = useUploadFile()
  const [activityDrawerOpen, setActivityDrawerOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [forceScrollCounter, setForceScrollCounter] = useState(0)
  const { data: ttsStatus } = useTtsStatus()
  const [terminalData, setTerminalData] = useState<string | null>(null)
  const { getForRoom } = offlineQueue
  const { triggerForMessage } = useHaptics()

  // Request notification permission once on mount
  useEffect(() => {
    requestPermission()
  }, [])

  // Restore offline queue and auto-flush
  useEffect(() => {
    let cancelled = false

    async function restore() {
      try {
        const queued = await getForRoom(roomId)
        if (cancelled || queued.length === 0) return
        appendItems(
          queued.map(q => ({
            sender: q.sender,
            content: q.content,
            created_at: new Date(q.timestamp).toISOString(),
            tempId: q.tempId,
            status: 'failed' as const,
            ...(q.attachmentIds?.length
              ? { attachmentIds: q.attachmentIds, attachment_count: q.attachmentIds.length }
              : {}),
          }))
        )
        // Auto-flush if online — use retry() which handles IndexedDB removal on success
        if (navigator.onLine) {
          for (const msg of queued) {
            if (cancelled) break
            handleRetry(msg.tempId)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- getForRoom/remove/appendItems/updateItemStatus/handleSend are stable
  }, [roomId])

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
    [userName, triggerForMessage]
  )

  const { connected, sendTerminalSubscribe, sendTerminalUnsubscribe, sendTerminalResize } =
    useRoomWebSocket(roomId, apiKey, onWsMessage, {
      onTerminalData: setTerminalData,
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

  // Flush queue on coming online — use retry() to avoid duplicates and handle IndexedDB removal
  useEffect(() => {
    const handler = async () => {
      try {
        const queued = await getForRoom(roomId)
        for (const msg of queued) {
          handleRetry(msg.tempId)
        }
      } catch {
        /* ignore */
      }
    }
    window.addEventListener('online', handler)
    return () => window.removeEventListener('online', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- getForRoom/handleRetry are stable
  }, [roomId])

  const handleUploadFile = useCallback(
    (file: File) => uploadFileMutation.mutateAsync({ roomId: roomId, file }),
    [roomId, uploadFileMutation]
  )

  const handleSendWithScroll = useCallback(
    (content: string, attachmentIds: string[] = []) => {
      handleSend(content, attachmentIds)
      setForceScrollCounter(c => c + 1)
    },
    [handleSend]
  )

  return (
    <>
      <TerminalViewerModal
        open={terminalOpen}
        onClose={() => onTerminalClose?.()}
        data={terminalData}
        onResize={sendTerminalResize}
      />
      {timelineLoading && timeline.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <div className="text-sm text-[#888]">Loading messages...</div>
        </div>
      ) : timelineError && timeline.length === 0 ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2">
          <div className="text-sm text-[#e74c3c]">Failed to load messages</div>
          <div className="text-xs text-[#888]">{timelineError.message}</div>
        </div>
      ) : (
        <MessageList
          messages={timeline}
          attachmentCounts={attachmentCounts}
          roomId={roomId}
          userName={userName}
          unreadCount={unreadCount}
          forceScrollCounter={forceScrollCounter}
          onScrollToBottom={() => setUnreadCount(0)}
          onRetry={handleRetry}
          onSend={handleSendWithScroll}
          connected={connected}
          voiceAvailable={ttsStatus?.available}
        />
      )}
      <ActivityBar onClick={() => setActivityDrawerOpen(true)} />
      <ActivityLogDrawer
        open={activityDrawerOpen}
        onOpenChange={setActivityDrawerOpen}
        messages={timeline}
      />
      <ChatInput onSend={handleSendWithScroll} onUploadFile={handleUploadFile} />
    </>
  )
}
