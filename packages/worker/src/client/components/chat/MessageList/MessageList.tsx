import { useRef, useEffect } from 'hono/jsx/dom'
import Message from '../Message'
import LogGroup from '../LogGroup'
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

type RenderItem =
  | { kind: 'message'; msg: DisplayMessage; index: number }
  | { kind: 'log-group'; logs: DisplayMessage[] }

function groupMessages(messages: DisplayMessage[]): RenderItem[] {
  const items: RenderItem[] = []
  let logBuffer: DisplayMessage[] = []

  function flushLogs() {
    if (logBuffer.length > 0) {
      items.push({ kind: 'log-group', logs: logBuffer })
      logBuffer = []
    }
  }

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    if (msg.type === 'log') {
      logBuffer.push(msg)
    } else {
      flushLogs()
      items.push({ kind: 'message', msg, index: i })
    }
  }
  flushLogs()

  return items
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

  const items = groupMessages(messages)

  return (
    <div class="messages" ref={containerRef}>
      {items.map((item, i) => {
        if (item.kind === 'log-group') {
          const first = item.logs[0]
          return (
            <LogGroup
              key={`log-group-${first.sender}-${first.created_at}-${i}`}
              logs={item.logs}
            />
          )
        }
        const msg = item.msg
        return (
          <Message
            key={msg.tempId || `${msg.sender}-${msg.created_at}-${item.index}`}
            sender={msg.sender}
            content={msg.content}
            color={msg.color}
            timestamp={msg.created_at}
            tempId={msg.tempId}
            status={msg.status}
            onRetry={msg.tempId && onRetry ? () => onRetry(msg.tempId!) : undefined}
          />
        )
      })}
      <NewMessagesPill
        count={unreadCount}
        onClick={() => { scrollToBottom(); onScrollToBottom() }}
      />
    </div>
  )
}
