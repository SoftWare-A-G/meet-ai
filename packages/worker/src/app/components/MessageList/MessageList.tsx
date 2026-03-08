import { useEffect, useRef } from 'react'
import { useStickToBottom } from 'use-stick-to-bottom'
import Message from '../Message'
import LogGroup from '../LogGroup'
import DiffBlock from '../DiffBlock'
import QuestionCard from '../QuestionCard'
import PlanReviewCard from '../PlanReviewCard'
import PermissionCard from '../PermissionCard'
import SpawnRequestCard from '../SpawnRequestCard'
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
  permissionDecisions?: Record<string, { status: 'pending' | 'approved' | 'denied' | 'expired'; feedback?: string }>
  unreadCount: number
  forceScrollCounter: number
  onScrollToBottom: () => void
  onRetry?: (tempId: string) => void
  onSend?: (content: string) => void
  onPlanDecide?: (reviewId: string, approved: boolean, feedback?: string, permissionMode?: string) => void
  onPlanDismiss?: (reviewId: string) => void
  onQuestionAnswer?: (reviewId: string, answers: Record<string, string>) => void
  onPermissionDecide?: (reviewId: string, approved: boolean, feedback?: string) => void
  connected?: boolean
  voiceAvailable?: boolean
}

type RenderItem =
  | { kind: 'message'; msg: DisplayMessage; index: number }
  | { kind: 'question'; msg: DisplayMessage; index: number }
  | { kind: 'plan-review'; msg: DisplayMessage; index: number }
  | { kind: 'permission-review'; msg: DisplayMessage; index: number }
  | { kind: 'spawn-request'; msg: DisplayMessage; index: number; roomName: string; codingAgent?: string }
  | { kind: 'log-group'; logs: DisplayMessage[] }
  | { kind: 'diff-log'; logs: DisplayMessage[] }

function getDiffFilename(content: string): string | null {
  const match = content.match(/^\[diff:(.+?)\]/)
  return match ? match[1] : null
}

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
    if (msg.type === 'log' && msg.content.startsWith('[diff:')) {
      flushLogs()
      items.push({ kind: 'diff-log', logs: [msg] })
    } else if (msg.type === 'log') {
      logBuffer.push(msg)
    } else {
      flushLogs()
      const children = msg.id ? childLogs.get(msg.id) : undefined
      const isQuestion = msg.sender === 'hook' && msg.color === '#f59e0b'
      const isPlanReview = msg.sender === 'hook' && msg.color === '#8b5cf6'
      const isPermissionReview = msg.sender === 'hook' && msg.color === '#f97316'
      const isHookAnchor = msg.sender === 'hook' && !isQuestion && !isPlanReview && !isPermissionReview

      // Detect spawn_request messages by content
      let spawnRoomName: string | null = null
      let spawnCodingAgent: string | undefined
      try {
        const parsed = JSON.parse(msg.content)
        if (parsed?.type === 'spawn_request' && parsed?.room_name) {
          spawnRoomName = parsed.room_name
          if (typeof parsed?.coding_agent === 'string') {
            spawnCodingAgent = parsed.coding_agent
          }
        }
      } catch { /* not JSON */ }

      // Hook anchor messages never render as bubbles — they only exist as log group anchors
      if (spawnRoomName) {
        items.push({ kind: 'spawn-request', msg, index, roomName: spawnRoomName, codingAgent: spawnCodingAgent })
      } else if (isQuestion) {
        items.push({ kind: 'question', msg, index })
      } else if (isPlanReview) {
        items.push({ kind: 'plan-review', msg, index })
      } else if (isPermissionReview) {
        items.push({ kind: 'permission-review', msg, index })
      } else if (!isHookAnchor) {
        items.push({ kind: 'message', msg, index })
      }
      if (children && children.length > 0) {
        const diffLogs: DisplayMessage[] = []
        const regularLogs: DisplayMessage[] = []
        for (const child of children) {
          if (child.content.startsWith('[diff:')) {
            diffLogs.push(child)
          } else {
            regularLogs.push(child)
          }
        }
        if (regularLogs.length > 0) {
          items.push({ kind: 'log-group', logs: regularLogs })
        }
        for (const dl of diffLogs) {
          items.push({ kind: 'diff-log', logs: [dl] })
        }
      }
    }
  }
  flushLogs()

  // Merge consecutive diff-log items for the same file
  const merged: RenderItem[] = []
  for (const item of items) {
    if (item.kind === 'diff-log') {
      const prev = merged[merged.length - 1]
      if (prev?.kind === 'diff-log') {
        const prevFile = getDiffFilename(prev.logs[0].content)
        const curFile = getDiffFilename(item.logs[0].content)
        if (prevFile && curFile && prevFile === curFile) {
          prev.logs.push(...item.logs)
          continue
        }
      }
    }
    merged.push(item)
  }

  return merged
}

export default function MessageList({ messages, attachmentCounts, planDecisions, questionAnswers, permissionDecisions, unreadCount, forceScrollCounter, onScrollToBottom, onRetry, onSend, onPlanDecide, onPlanDismiss, onQuestionAnswer, onPermissionDecide, connected = true, voiceAvailable }: MessageListProps) {
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

  // iOS keyboard dismiss: scroll to bottom when viewport height increases (keyboard closing)
  const prevHeightRef = useRef(0)
  const isAtBottomRef = useRef(isAtBottom)
  isAtBottomRef.current = isAtBottom
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    prevHeightRef.current = vv.height
    const onResize = () => {
      const grew = vv.height > prevHeightRef.current
      prevHeightRef.current = vv.height
      // Viewport grew = keyboard closed; re-stick if we were at the bottom
      if (grew && isAtBottomRef.current) {
        scrollToBottom()
      }
    }
    vv.addEventListener('resize', onResize)
    return () => vv.removeEventListener('resize', onResize)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- scrollToBottom is stable, isAtBottomRef is a ref
  }, [])

  const items = groupMessages(messages)

  return (
    <div className="flex-1 overflow-y-auto px-2 py-4 min-h-0 relative flex flex-col" ref={scrollRef}>
      {!connected && (
        <div className="absolute top-0 left-0 right-0 z-10 px-3 py-1 text-xs text-center bg-[#eab308]/15 text-[#eab308] border-b border-[#eab308]/25 backdrop-blur-sm">Reconnecting...</div>
      )}
      <div className="flex-1" />
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
          if (item.kind === 'spawn-request') {
            return (
              <SpawnRequestCard
                key={`spawn-${item.msg.id || item.msg.created_at}-${item.index}`}
                roomName={item.roomName}
                codingAgent={item.codingAgent}
                sender={item.msg.sender}
                timestamp={item.msg.created_at}
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
          if (item.kind === 'permission-review') {
            const msg = item.msg
            const reviewId = msg.permission_review_id || ''
            const decision = reviewId && permissionDecisions ? permissionDecisions[reviewId] : undefined
            return (
              <PermissionCard
                key={`permission-${msg.id || msg.created_at}-${item.index}`}
                content={msg.content}
                timestamp={msg.created_at}
                reviewId={reviewId}
                status={decision?.status}
                feedback={decision?.feedback}
                onDecide={onPermissionDecide}
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
          if (item.kind === 'diff-log') {
            const hunks: string[] = []
            let filename = ''
            for (const log of item.logs) {
              const match = log.content.match(/^\[diff:(.+?)\]\n([\s\S]*)$/)
              if (match) {
                filename = match[1]
                hunks.push(match[2])
              }
            }
            if (hunks.length > 0) {
              const lastLog = item.logs[item.logs.length - 1]
              return (
                <DiffBlock
                  key={`diff-${item.logs[0].created_at}-${i}`}
                  filename={filename}
                  hunks={hunks}
                  timestamp={lastLog.created_at}
                  changeCount={hunks.length > 1 ? hunks.length : undefined}
                />
              )
            }
            return null
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
