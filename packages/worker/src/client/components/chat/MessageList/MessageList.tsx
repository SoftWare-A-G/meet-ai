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
  forceScrollCounter: number
  onScrollToBottom: () => void
  onRetry?: (tempId: string) => void
  connected?: boolean
}

type RenderItem =
  | { kind: 'message'; msg: DisplayMessage; index: number }
  | { kind: 'log-group'; logs: DisplayMessage[] }

function groupMessages(messages: DisplayMessage[]): RenderItem[] {
  // Build a map of message_id -> child logs for parent-child grouping
  const childLogs = new Map<string, DisplayMessage[]>()
  const standaloneItems: { index: number; msg: DisplayMessage }[] = []

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    if (msg.type === 'log' && msg.message_id) {
      const arr = childLogs.get(msg.message_id) || []
      arr.push(msg)
      childLogs.set(msg.message_id, arr)
    } else {
      standaloneItems.push({ index: i, msg })
    }
  }

  const items: RenderItem[] = []
  let logBuffer: DisplayMessage[] = []

  function flushLogs() {
    if (logBuffer.length > 0) {
      items.push({ kind: 'log-group', logs: logBuffer })
      logBuffer = []
    }
  }

  for (const { index, msg } of standaloneItems) {
    if (msg.type === 'log') {
      logBuffer.push(msg)
    } else {
      flushLogs()
      const children = msg.id ? childLogs.get(msg.id) : undefined
      const isHookAnchor = msg.sender === 'hook' && children && children.length > 0
      // Hook messages with child logs only serve as time anchors — don't render them as bubbles
      if (!isHookAnchor) {
        items.push({ kind: 'message', msg, index })
      }
      if (children && children.length > 0) {
        items.push({ kind: 'log-group', logs: children })
      }
    }
  }
  flushLogs()

  return items
}

export default function MessageList({ messages, unreadCount, forceScrollCounter, onScrollToBottom, onRetry, connected = true }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { isAtBottom, atBottom, scrollToBottom } = useScrollAnchor(containerRef)
  const prevLengthRef = useRef<number>(0)
  const wasAtBottomBeforeUpdate = useRef(true)

  // Snapshot scroll position BEFORE render (during the render phase)
  // so we know if the user was at the bottom before new messages grew scrollHeight.
  if (messages.length > (prevLengthRef.current ?? 0)) {
    wasAtBottomBeforeUpdate.current = isAtBottom()
  }

  useEffect(() => {
    if (messages.length > (prevLengthRef.current ?? 0) && wasAtBottomBeforeUpdate.current) {
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

  // Force scroll to bottom when user sends a message (always, regardless of position)
  useEffect(() => {
    if (forceScrollCounter > 0) {
      scrollToBottom()
    }
  }, [forceScrollCounter])

  // Scroll to bottom on initial load
  useEffect(() => {
    scrollToBottom()
  }, [])

  const items = groupMessages(messages)

  return (
    <div class="messages" ref={containerRef}>
      {!connected && (
        <div class="reconnecting-bar">Reconnecting...</div>
      )}
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
