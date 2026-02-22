import { useEffect } from 'react'
import { useStickToBottom } from 'use-stick-to-bottom'
import Message from '../Message'
import LogGroup from '../LogGroup'
import QuestionCard from '../QuestionCard'
import PlanReviewCard from '../PlanReviewCard'
import NewMessagesPill from '../NewMessagesPill'
import type { Message as MessageType } from '../../lib/types'

type DisplayMessage = MessageType & {
  tempId?: string
  status?: 'sent' | 'pending' | 'failed'
}

type QuestionAnswerState = { status: 'pending' | 'answered' | 'expired'; answers?: Record<string, string> }

type MessageListProps = {
  messages: DisplayMessage[]
  attachmentCounts?: Record<string, number>
  planDecisions?: Record<string, { status: 'pending' | 'approved' | 'denied' | 'expired'; feedback?: string; permissionMode?: string }>
  questionAnswers?: Record<string, QuestionAnswerState>
  unreadCount: number
  forceScrollCounter: number
  onScrollToBottom: () => void
  onRetry?: (tempId: string) => void
  onSend?: (content: string) => void
  onPlanDecide?: (reviewId: string, approved: boolean, feedback?: string, permissionMode?: string) => void
  onPlanDismiss?: (reviewId: string) => void
  onQuestionAnswer?: (reviewId: string, answers: Record<string, string>) => void
  connected?: boolean
  voiceAvailable?: boolean
}

type RenderItem =
  | { kind: 'message'; msg: DisplayMessage; index: number }
  | { kind: 'question'; msg: DisplayMessage; index: number }
  | { kind: 'plan-review'; msg: DisplayMessage; index: number }
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
      const isQuestion = msg.sender === 'hook' && msg.color === '#f59e0b'
      const isPlanReview = msg.sender === 'hook' && msg.color === '#8b5cf6'
      const isHookAnchor = msg.sender === 'hook' && !isQuestion && !isPlanReview
      // Hook anchor messages never render as bubbles — they only exist as log group anchors
      if (isQuestion) {
        items.push({ kind: 'question', msg, index })
      } else if (isPlanReview) {
        items.push({ kind: 'plan-review', msg, index })
      } else if (!isHookAnchor) {
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

export default function MessageList({ messages, attachmentCounts, planDecisions, questionAnswers, unreadCount, forceScrollCounter, onScrollToBottom, onRetry, onSend, onPlanDecide, onPlanDismiss, onQuestionAnswer, connected = true, voiceAvailable }: MessageListProps) {
  const { scrollRef, contentRef, isAtBottom, scrollToBottom } = useStickToBottom({ resize: 'smooth', initial: 'smooth' })

  // Auto-dismiss new messages pill when user scrolls to the bottom
  useEffect(() => {
    if (isAtBottom && unreadCount > 0) {
      onScrollToBottom()
    }
  }, [isAtBottom, unreadCount, onScrollToBottom])

  // Force scroll to bottom when user sends a message (always, regardless of position)
  useEffect(() => {
    if (forceScrollCounter > 0) {
      scrollToBottom()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- scrollToBottom is stable
  }, [forceScrollCounter])

  const items = groupMessages(messages)

  return (
    <div className="flex-1 overflow-y-auto px-2 py-4 min-h-0 relative" ref={scrollRef}>
      {!connected && (
        <div className="absolute top-0 left-0 right-0 z-10 px-3 py-1 text-xs text-center bg-[#eab308]/15 text-[#eab308] border-b border-[#eab308]/25 backdrop-blur-sm">Reconnecting...</div>
      )}
      <div className="flex flex-col gap-0.5" ref={contentRef}>
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
          if (item.kind === 'plan-review' && onPlanDecide) {
            const msg = item.msg
            const reviewId = msg.plan_review_id || ''
            const decision = reviewId && planDecisions ? planDecisions[reviewId] : undefined
            return (
              <PlanReviewCard
                key={`plan-review-${msg.id || msg.created_at}-${item.index}`}
                content={msg.content}
                timestamp={msg.created_at}
                reviewId={reviewId}
                status={decision?.status}
                feedback={decision?.feedback}
                onDecide={onPlanDecide}
                onDismiss={onPlanDismiss}
              />
            )
          }
          if (item.kind === 'question' && onSend) {
            const msg = item.msg
            const reviewId = msg.question_review_id || ''
            const qState = reviewId && questionAnswers ? questionAnswers[reviewId] : undefined

            // Fall back to old text-based detection when no review ID
            const nextHuman = !reviewId
              ? messages.slice(item.index + 1).find(m => m.type !== 'log' && m.sender !== 'hook')
              : undefined
            const answeredWith = nextHuman?.content

            return (
              <QuestionCard
                key={`question-${msg.id || msg.created_at}-${item.index}`}
                content={msg.content}
                timestamp={msg.created_at}
                onSend={onSend}
                answeredWith={answeredWith}
                questionReviewId={reviewId || undefined}
                questionReviewStatus={qState?.status}
                questionReviewAnswers={qState?.answers}
                onQuestionAnswer={onQuestionAnswer}
              />
            )
          }
          const msg = item.msg
          const attCount = msg.id && attachmentCounts ? attachmentCounts[msg.id] : undefined
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
              attachmentCount={attCount}
              voiceAvailable={voiceAvailable}
            />
          )
        })}
      </div>
      {!isAtBottom && (
        <NewMessagesPill
          count={unreadCount}
          onClick={() => { scrollToBottom(); onScrollToBottom() }}
        />
      )}
    </div>
  )
}
