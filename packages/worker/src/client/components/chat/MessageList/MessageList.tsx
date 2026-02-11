import { useRef, useEffect } from 'hono/jsx/dom'
import Message from '../Message'
import NewMessagesPill from '../NewMessagesPill'
import { useScrollAnchor } from '../../../hooks/useScrollAnchor'
import type { Message as MessageType } from '../../../lib/types'

type DisplayMessage = MessageType & {
  tempId?: string
  status?: 'sent' | 'pending' | 'failed'
}

type MessageListProps = {
  messages: DisplayMessage[]
  unreadCount: number
  onScrollToBottom: () => void
  onRetry?: (tempId: string) => void
}

export default function MessageList({ messages, unreadCount, onScrollToBottom, onRetry }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { isAtBottom, atBottom, scrollToBottom } = useScrollAnchor(containerRef)
  const prevLengthRef = useRef<number>(0)

  useEffect(() => {
    if (messages.length > (prevLengthRef.current ?? 0) && isAtBottom()) {
      scrollToBottom()
    }
    prevLengthRef.current = messages.length
  }, [messages.length])

  // Auto-dismiss new messages pill when user scrolls to the bottom
  useEffect(() => {
    if (atBottom && unreadCount > 0) {
      onScrollToBottom()
    }
  }, [atBottom, unreadCount, onScrollToBottom])

  // Scroll to bottom on initial load
  useEffect(() => {
    scrollToBottom()
  }, [])

  return (
    <div class="messages" ref={containerRef}>
      {messages.map((msg, i) => (
        <Message
          key={msg.tempId || `${msg.sender}-${msg.created_at}-${i}`}
          sender={msg.sender}
          content={msg.content}
          color={msg.color}
          timestamp={msg.created_at}
          tempId={msg.tempId}
          status={msg.status}
          onRetry={msg.tempId && onRetry ? () => onRetry(msg.tempId!) : undefined}
        />
      ))}
      <NewMessagesPill
        count={unreadCount}
        onClick={() => { scrollToBottom(); onScrollToBottom() }}
      />
    </div>
  )
}
