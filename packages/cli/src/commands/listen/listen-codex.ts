import { downloadMessageAttachments } from '@meet-ai/cli/lib/attachments'
import { getHomeCredentials } from '@meet-ai/cli/lib/meetai-home'
import { appendCodexInboxEntry, readCurrentCodexSessionId } from '@meet-ai/cli/lib/codex'
import {
  type CodexAppServerEvent,
  type CodexBridge,
  type CodexInjectionResult,
  createCodexAppServerBridge,
  describeCodexAppServerError,
} from '@meet-ai/cli/lib/codex-app-server'
import { emitCodexAppServerLog } from '@meet-ai/cli/lib/codex-app-server-evlog'
import { TASK_TOOL_SPECS, TASK_TOOL_NAMES, createTaskToolCallHandler } from '@meet-ai/cli/lib/codex-task-tools'
import { CANVAS_TOOL_SPECS, CANVAS_TOOL_NAMES, createCanvasToolCallHandler } from '@meet-ai/cli/lib/codex-canvas-tools'
import { createHookClient, sendLogEntry, sendParentMessage } from '@meet-ai/cli/lib/hooks/client'
import { findRoom } from '@meet-ai/cli/lib/hooks/find-room'
import { createTask, updateTask, listTasks, getTask } from '@meet-ai/cli/lib/hooks/tasks'
import { ensureCanvas, getCanvasSnapshot, applyCanvasMutations } from '@meet-ai/cli/lib/hooks/canvas'
import {
  createPlanReview,
  expirePlanReview,
  formatCodexPlanReviewContent,
  pollForPlanDecision,
} from '@meet-ai/cli/lib/plan-review'
import {
  requestRoomQuestionReview,
  type QuestionReviewQuestion,
} from '@meet-ai/cli/lib/question-review'
import {
  registerActiveTeamMember,
  type TeamMemberRegistrar,
} from '@meet-ai/cli/lib/team-member-registration'
import { ListenInput } from './schema'
import { createTerminalControlHandler, isHookAnchorMessage, type ListenMessage } from './shared'
import type {
  ToolRequestUserInputParams,
  ToolRequestUserInputResponse,
} from '@meet-ai/cli/generated/codex-app-server/v2'
import type { MeetAiClient, Message } from '@meet-ai/cli/types'

type CodexListenDeps = {
  createHookClient: typeof createHookClient
  createPlanReview: typeof createPlanReview
  pollForPlanDecision: typeof pollForPlanDecision
  expirePlanReview: typeof expirePlanReview
}

const DEFAULT_CODEX_LISTEN_DEPS: CodexListenDeps = {
  createHookClient,
  createPlanReview,
  pollForPlanDecision,
  expirePlanReview,
}

function normalizeFinalText(value: string): string {
  return value.replace(/\r\n/g, '\n').trim()
}

function previewText(value: string, limit = 120): string {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (normalized.length <= limit) return normalized
  return `${normalized.slice(0, limit)}...`
}

function formatPlanUpdateLogSummary(input: {
  explanation: string | null
  plan: { step: string; status: string }[]
}): string {
  const planStepCount = input.plan.length
  const explanation = input.explanation?.trim() ? previewText(input.explanation, 160) : null
  const firstStep = input.plan[0]?.step?.trim() ? previewText(input.plan[0].step, 120) : null
  const statusCounts = input.plan.reduce<Record<string, number>>((counts, step) => {
    counts[step.status] = (counts[step.status] ?? 0) + 1
    return counts
  }, {})
  const statusSummary = Object.entries(statusCounts)
    .map(([status, count]) => `${status}=${count}`)
    .join(', ')

  return [
    explanation
      ? `Codex plan updated: ${explanation}`
      : `Codex plan updated (${planStepCount} steps)`,
    `steps: ${planStepCount}${statusSummary ? ` (${statusSummary})` : ''}`,
    firstStep ? `first_step: ${firstStep}` : null,
  ]
    .filter(Boolean)
    .join('\n')
}

function isPlainChatMessage(msg: ListenMessage): boolean {
  return msg.type == null || msg.type === 'message'
}

type TaskItem = {
  id: string
  subject: string
  description?: string
  status: 'pending' | 'in_progress' | 'completed'
  assignee: string | null
  owner: string | null
  source: 'claude' | 'codex' | 'meet_ai'
  source_id: string | null
  updated_by: string | null
  updated_at: number
}

type TasksInfoMessage = {
  type: 'tasks_info'
  tasks: TaskItem[]
}

function isTasksInfoMessage(msg: unknown): msg is TasksInfoMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    (msg as Record<string, unknown>).type === 'tasks_info' &&
    Array.isArray((msg as Record<string, unknown>).tasks)
  )
}

function formatTaskPayload(task: TaskItem): string {
  const description = task.description?.trim() ? task.description.trim() : 'None'
  const assignee = task.assignee ?? 'unassigned'

  return [
    `task_id: ${task.id}`,
    `subject: ${task.subject}`,
    `description: ${description}`,
    `status: ${task.status}`,
    `assignee: ${assignee}`,
  ].join('\n')
}

function diffTasks(prev: Map<string, TaskItem>, next: TaskItem[], agentName: string): string[] {
  const notifications: string[] = []

  for (const task of next) {
    const isAssignedToMe =
      task.assignee != null && task.assignee.toLowerCase() === agentName.toLowerCase()
    if (!isAssignedToMe) continue

    const old = prev.get(task.id)

    if (!old) {
      // Newly visible task assigned to this agent
      notifications.push(`New task assigned to you:\n${formatTaskPayload(task)}`)
      continue
    }

    const wasAssignedToMe =
      old.assignee != null && old.assignee.toLowerCase() === agentName.toLowerCase()

    if (!wasAssignedToMe) {
      // Task reassigned to this agent
      notifications.push(`Task assigned to you:\n${formatTaskPayload(task)}`)
      continue
    }

    if (old.status !== task.status) {
      notifications.push(
        `Task status changed (${old.status} → ${task.status}):\n${formatTaskPayload(task)}`
      )
    }
  }

  return notifications
}

function makeTurnKey(event: { turnId: string | null; itemId: string | null }): string {
  return event.turnId ?? event.itemId ?? 'unknown'
}

type TurnMessageState = {
  itemOrder: string[]
  itemTexts: Map<string, string>
  sent: boolean
  sending: boolean
}

type TurnPlanReviewState = {
  sequence: number
  content: string
  reviewId: string | null
}

function buildPublishedText(state: TurnMessageState): string {
  return normalizeFinalText(
    state.itemOrder
      .map(itemId => normalizeFinalText(state.itemTexts.get(itemId) ?? ''))
      .filter(Boolean)
      .join('\n\n')
  )
}

async function resolveCodexTeamName(roomId: string): Promise<string | undefined> {
  const sessionId = readCurrentCodexSessionId()
  if (!sessionId) return undefined

  const room = await findRoom(sessionId)
  if (!room || room.roomId !== roomId) return undefined
  return room.teamName
}

function toQuestionReviewQuestions(
  params: ToolRequestUserInputParams
): QuestionReviewQuestion[] | null {
  const questions: QuestionReviewQuestion[] = []

  for (const question of params.questions) {
    if (!Array.isArray(question.options) || question.options.length === 0 || question.isSecret) {
      return null
    }

    const options = question.options.map(option => ({
      label: option.label,
      description: option.description || undefined,
    }))

    if (question.isOther) {
      options.push({
        label: 'Other',
        description: 'Choose this only if you need to answer outside the listed options.',
      })
    }

    questions.push({
      question: question.question,
      header: question.header || undefined,
      options,
    })
  }

  return questions
}

async function requestCodexUserInputViaRoom(
  hookClient: ReturnType<typeof createHookClient>,
  roomId: string,
  params: ToolRequestUserInputParams
): Promise<ToolRequestUserInputResponse> {
  const questions = toQuestionReviewQuestions(params)
  if (!questions) {
    emitCodexAppServerLog('warn', 'listen-codex', 'request_user_input.unsupported', {
      reason: 'missing_options_or_secret_question',
      questionCount: params.questions.length,
    })
    return { answers: {} }
  }

  const result = await requestRoomQuestionReview(hookClient, roomId, questions)
  if (result.status !== 'answered') {
    emitCodexAppServerLog('warn', 'listen-codex', 'request_user_input.unanswered', {
      status: result.status,
      questionCount: questions.length,
    })
    return { answers: {} }
  }

  const answers: ToolRequestUserInputResponse['answers'] = {}
  for (const question of params.questions) {
    const answer = result.answers[question.question]
    if (!answer) continue

    answers[question.id] = {
      answers: [answer],
    }
  }

  return { answers }
}

function buildCodexPlanDecisionPrompt(input: {
  status: 'approved' | 'denied' | 'expired'
  feedback?: string
  permissionMode?: string
}): string {
  if (input.status === 'approved') {
    const lines = [
      'Your plan was approved in the Meet AI review UI. Continue with implementation now.',
    ]
    if (input.permissionMode && input.permissionMode !== 'default') {
      lines.push(`Requested permission mode: ${input.permissionMode}.`)
    }
    return lines.join('\n')
  }

  const feedback = input.feedback?.trim()
  const lines = [
    input.status === 'expired'
      ? 'Your plan preview was dismissed in the Meet AI UI. Do not propose another plan unless the user explicitly asks for one.'
      : 'Your plan was rejected in the Meet AI preview UI. Revise the plan before continuing.',
  ]

  if (feedback) {
    lines.push('', 'Feedback:', feedback)
  }

  return lines.join('\n')
}

export function listenCodex(
  client: MeetAiClient,
  input: {
    roomId?: string
    exclude?: string
    senderType?: string
    team?: string
    inbox?: string
  },
  codexBridgeOverride?: CodexBridge | null,
  teamMemberRegistrar: TeamMemberRegistrar = registerActiveTeamMember,
  deps: CodexListenDeps = DEFAULT_CODEX_LISTEN_DEPS
): WebSocket {
  const parsed = ListenInput.parse(input)
  const { roomId, exclude, senderType, team, inbox } = parsed
  let shutdownStarted = false

  if (team || inbox) {
    const flags = [team ? '--team' : null, inbox ? '--inbox' : null].filter(Boolean).join(', ')
    throw new Error(
      `Codex listen does not support Claude inbox routing flags (${flags}). Run meet-ai listen without Claude-specific routing options.`
    )
  }

  const terminal = createTerminalControlHandler({ client, roomId })

  const homeCreds = getHomeCredentials()
  if (!homeCreds) throw new Error("No meet-ai credentials found. Run 'meet-ai' to set up.")
  const { url: meetAiUrl, key: meetAiKey } = homeCreds
  const hookClient = deps.createHookClient(meetAiUrl, meetAiKey)
  let activityParentId: string | null = null
  let activityLogQueue: Promise<void> = Promise.resolve()
  const taskToolCallHandler =
    hookClient && roomId
      ? createTaskToolCallHandler({
          createTask: params => createTask(hookClient, roomId, { ...params, source: 'codex' }),
          updateTask: (taskId, params) =>
            updateTask(hookClient, roomId, taskId, { ...params, source: 'codex' }),
          listTasks: filters => listTasks(hookClient, roomId, filters),
          getTask: taskId => getTask(hookClient, roomId, taskId),
        })
      : undefined

  const canvasToolCallHandler =
    hookClient && roomId
      ? createCanvasToolCallHandler({
          ensureCanvas: () => ensureCanvas(hookClient, roomId),
          getSnapshot: () => getCanvasSnapshot(hookClient, roomId),
          applyMutations: mutations =>
            applyCanvasMutations(
              hookClient,
              roomId,
              mutations as Parameters<typeof applyCanvasMutations>[2],
            ),
        })
      : undefined

  const bootstrapPrompt = process.env.MEET_AI_CODEX_BOOTSTRAP_PROMPT?.trim()
  const codexSender = process.env.MEET_AI_AGENT_NAME?.trim() || 'codex'
  const messageState = new Map<string, TurnMessageState>()
  const turnPlanReviews = new Map<string, TurnPlanReviewState>()
  let publishQueue: Promise<void> = Promise.resolve()

  const enqueuePublish = (task: () => Promise<void>) => {
    publishQueue = publishQueue.then(task, task).catch(error => {
      console.error(
        `meet-ai: failed to publish Codex output to room: ${error instanceof Error ? error.message : String(error)}`
      )
    })
  }

  const enqueueActivityLog = (summary: string) => {
    if (!hookClient) return
    activityLogQueue = activityLogQueue
      .then(async () => {
        if (!activityParentId) {
          activityParentId = await sendParentMessage(hookClient, roomId)
        }
        await sendLogEntry(hookClient, roomId, summary, activityParentId ?? undefined)
      })
      .catch(error => {
        console.error(
          `meet-ai: failed to publish Codex activity log: ${error instanceof Error ? error.message : String(error)}`
        )
      })
  }

  const requestUserInputHandler =
    hookClient && roomId
      ? (params: ToolRequestUserInputParams) =>
          requestCodexUserInputViaRoom(hookClient, roomId, params)
      : undefined
  const combinedToolCallHandler =
    taskToolCallHandler || canvasToolCallHandler
      ? async (tool: string, args: unknown) => {
          if (taskToolCallHandler && TASK_TOOL_NAMES.has(tool)) return taskToolCallHandler(tool, args)
          if (canvasToolCallHandler && CANVAS_TOOL_NAMES.has(tool)) return canvasToolCallHandler(tool, args)
          return { contentItems: [{ type: 'inputText' as const, text: JSON.stringify({ error: `Unknown tool: ${tool}` }) }], success: false }
        }
      : undefined

  const codexBridge: CodexBridge =
    codexBridgeOverride ??
    createCodexAppServerBridge({
      threadId: null,
      cwd: process.cwd(),
      experimentalApi: true,
      dynamicTools: [...TASK_TOOL_SPECS, ...CANVAS_TOOL_SPECS],
      ...(combinedToolCallHandler ? { toolCallHandler: combinedToolCallHandler } : {}),
      ...(requestUserInputHandler ? { requestUserInputHandler } : {}),
    })

  const injectPlanDecisionPrompt = (turnId: string, prompt: string) => {
    void codexBridge
      .injectPrompt(prompt)
      .then(result => {
        emitCodexAppServerLog('info', 'listen-codex', 'plan_review.decision_injected', {
          sourceTurnId: turnId,
          mode: result.mode,
          threadId: result.threadId,
          turnId: result.turnId,
          preview: previewText(prompt),
        })
      })
      .catch(error => {
        emitCodexAppServerLog('error', 'listen-codex', 'plan_review.decision_injection_failed', {
          sourceTurnId: turnId,
          error: describeCodexAppServerError(error),
          preview: previewText(prompt),
        })
      })
  }

  const isCurrentPlanReviewState = (turnId: string, sequence: number): boolean =>
    turnPlanReviews.get(turnId)?.sequence === sequence

  const handleTurnPlanUpdated = (
    event: Extract<CodexAppServerEvent, { type: 'turn_plan_updated' }>
  ) => {
    if (!hookClient) {
      emitCodexAppServerLog('warn', 'listen-codex', 'plan_review.unavailable', {
        turnId: event.turnId,
        reason: 'missing_hook_client',
      })
      return
    }

    const content = formatCodexPlanReviewContent({
      explanation: event.explanation,
      plan: event.plan,
    })
    const previousState = turnPlanReviews.get(event.turnId)
    if (previousState?.content === content) {
      emitCodexAppServerLog('debug', 'listen-codex', 'plan_review.unchanged', {
        turnId: event.turnId,
        reviewId: previousState.reviewId,
      })
      return
    }

    const nextState: TurnPlanReviewState = {
      sequence: (previousState?.sequence ?? 0) + 1,
      content,
      reviewId: null,
    }
    turnPlanReviews.set(event.turnId, nextState)
    const logSummary = formatPlanUpdateLogSummary({
      explanation: event.explanation,
      plan: event.plan,
    })
    emitCodexAppServerLog('info', 'listen-codex', 'plan_update.logged', {
      turnId: event.turnId,
      threadId: event.threadId,
      sequence: nextState.sequence,
      planStepCount: event.plan.length,
      summary: logSummary,
    })
    enqueueActivityLog(logSummary)

    void (async () => {
      if (previousState?.reviewId) {
        await deps.expirePlanReview(hookClient, roomId, previousState.reviewId)
      }

      if (!isCurrentPlanReviewState(event.turnId, nextState.sequence)) {
        return
      }

      emitCodexAppServerLog('info', 'listen-codex', 'plan_review.started', {
        turnId: event.turnId,
        threadId: event.threadId,
        sequence: nextState.sequence,
        planStepCount: event.plan.length,
      })
      const review = await deps.createPlanReview(hookClient, roomId, content)
      if (!review.ok) {
        emitCodexAppServerLog('error', 'listen-codex', 'plan_review.create_failed', {
          turnId: event.turnId,
          threadId: event.threadId,
          sequence: nextState.sequence,
          ...(review.error
            ? { error: String(review.error) }
            : { status: review.status, text: review.text }),
        })
        return
      }

      if (!isCurrentPlanReviewState(event.turnId, nextState.sequence)) {
        await deps.expirePlanReview(hookClient, roomId, review.review.id)
        return
      }

      const current = turnPlanReviews.get(event.turnId)
      if (!current || current.sequence !== nextState.sequence) {
        await deps.expirePlanReview(hookClient, roomId, review.review.id)
        return
      }
      current.reviewId = review.review.id

      const decision = await deps.pollForPlanDecision(hookClient, roomId, review.review.id)
      if (!isCurrentPlanReviewState(event.turnId, nextState.sequence)) {
        return
      }

      if (!decision) {
        emitCodexAppServerLog('warn', 'listen-codex', 'plan_review.timeout', {
          turnId: event.turnId,
          threadId: event.threadId,
          reviewId: review.review.id,
        })
        await deps.expirePlanReview(hookClient, roomId, review.review.id)
        turnPlanReviews.delete(event.turnId)
        return
      }

      emitCodexAppServerLog('info', 'listen-codex', 'plan_review.completed', {
        turnId: event.turnId,
        threadId: event.threadId,
        reviewId: review.review.id,
        status: decision.status,
      })

      turnPlanReviews.delete(event.turnId)
      if (
        decision.status === 'approved' ||
        decision.status === 'denied' ||
        decision.status === 'expired'
      ) {
        injectPlanDecisionPrompt(
          event.turnId,
          buildCodexPlanDecisionPrompt({
            status: decision.status,
            feedback: decision.feedback,
            permissionMode: decision.permission_mode,
          })
        )
      }
    })()
  }

  const publishBufferedMessage = (key: string) => {
    const state = messageState.get(key)
    const text = state ? buildPublishedText(state) : ''
    if (!state || state.sent || state.sending || !text) return

    emitCodexAppServerLog('info', 'listen-codex', 'room_publish.queued', {
      turnKey: key,
      itemCount: state.itemOrder.length,
      textLength: text.length,
      preview: previewText(text),
    })

    state.sending = true
    enqueuePublish(async () => {
      try {
        emitCodexAppServerLog('info', 'listen-codex', 'room_publish.started', {
          turnKey: key,
          itemCount: state.itemOrder.length,
          textLength: text.length,
          preview: previewText(text),
        })
        await client.sendMessage(roomId, codexSender, text)
        state.sent = true
        emitCodexAppServerLog('info', 'listen-codex', 'room_publish.completed', {
          turnKey: key,
          itemCount: state.itemOrder.length,
          textLength: text.length,
          preview: previewText(text),
        })
      } catch (error) {
        emitCodexAppServerLog('error', 'listen-codex', 'room_publish.failed', {
          turnKey: key,
          itemCount: state.itemOrder.length,
          textLength: text.length,
          preview: previewText(text),
          error: error instanceof Error ? error.message : String(error),
        })
        throw error
      } finally {
        state.sending = false
      }
    })
  }

  const mergeEventText = (
    event: Extract<CodexAppServerEvent, { type: 'agent_message_delta' | 'agent_message_completed' }>
  ) => {
    const key = makeTurnKey(event)
    const itemKey = event.itemId ?? key
    const nextText = event.text.replace(/\r\n/g, '\n')
    if (!nextText) return

    const existing = messageState.get(key)
    if (!existing) {
      messageState.set(key, {
        itemOrder: [itemKey],
        itemTexts: new Map([[itemKey, nextText]]),
        sent: false,
        sending: false,
      })
      emitCodexAppServerLog('debug', 'listen-codex', 'message_buffer.created', {
        turnKey: key,
        itemKey,
        eventType: event.type,
        chunkLength: nextText.length,
        totalLength: nextText.length,
        itemCount: 1,
        preview: previewText(nextText),
      })
      return
    }

    if (!existing.itemTexts.has(itemKey)) existing.itemOrder.push(itemKey)

    if (event.type === 'agent_message_completed') {
      existing.itemTexts.set(itemKey, nextText)
      const publishedText = buildPublishedText(existing)
      emitCodexAppServerLog('debug', 'listen-codex', 'message_buffer.updated', {
        turnKey: key,
        itemKey,
        eventType: event.type,
        chunkLength: nextText.length,
        totalLength: publishedText.length,
        itemCount: existing.itemOrder.length,
        preview: previewText(publishedText),
      })
      return
    }

    existing.itemTexts.set(itemKey, `${existing.itemTexts.get(itemKey) ?? ''}${nextText}`)
    const publishedText = buildPublishedText(existing)
    emitCodexAppServerLog('debug', 'listen-codex', 'message_buffer.updated', {
      turnKey: key,
      itemKey,
      eventType: event.type,
      chunkLength: nextText.length,
      totalLength: publishedText.length,
      itemCount: existing.itemOrder.length,
      preview: previewText(publishedText),
    })
  }

  codexBridge.setEventHandler(event => {
    if (event.type === 'agent_message_delta' || event.type === 'agent_message_completed') {
      mergeEventText(event)
      return
    }

    if (event.type === 'activity_log') {
      emitCodexAppServerLog('info', 'listen-codex', 'activity_log.received', {
        turnId: event.turnId,
        itemId: event.itemId,
        summary: event.summary,
      })
      enqueueActivityLog(event.summary)
      return
    }

    if (event.type === 'turn_plan_updated') {
      handleTurnPlanUpdated(event)
      return
    }

    if (event.type === 'turn_completed') {
      emitCodexAppServerLog('info', 'listen-codex', 'turn_completed.received', {
        turnId: event.turnId,
        pendingTurnKeys: Array.from(messageState.entries())
          .filter(([, state]) => !state.sent)
          .map(([key]) => key),
      })
      for (const [key, state] of messageState.entries()) {
        if (key === event.turnId || (!event.turnId && !state.sent)) {
          publishBufferedMessage(key)
        }
      }
    }
  })

  const injectMessage = (message: { sender: string; content: string; attachments?: string[] }) => {
    void codexBridge
      .injectText({
        sender: message.sender,
        content: message.content,
        timestamp: new Date().toISOString(),
        attachments: message.attachments,
      })
      .then(result => {
        appendCodexInboxEntry(result.threadId, {
          from: `meet-ai:${message.sender}`,
          text: message.content,
          timestamp: new Date().toISOString(),
          read: false,
          ...(message.attachments?.length ? { attachments: message.attachments } : {}),
        })
        emitCodexAppServerLog('info', 'listen-codex', 'injection.completed', {
          mode: result.mode,
          threadId: result.threadId,
          turnId: result.turnId,
          sender: message.sender,
          attachmentCount: message.attachments?.length ?? 0,
        })
      })
      .catch(error => {
        emitCodexAppServerLog('error', 'listen-codex', 'injection.failed', {
          sender: message.sender,
          error: describeCodexAppServerError(error),
        })
      })
  }

  const knownTasks = new Map<string, TaskItem>()
  let isFirstTasksInfo = true

  const handleTasksInfo = (msg: ListenMessage) => {
    if (!isTasksInfoMessage(msg)) return false

    // First tasks_info is the cached snapshot from the DO —
    // use it as a baseline without generating notifications.
    if (isFirstTasksInfo) {
      isFirstTasksInfo = false
      for (const task of msg.tasks) {
        knownTasks.set(task.id, task)
      }
      return true
    }

    const notifications = diffTasks(knownTasks, msg.tasks, codexSender)

    // Update cache with latest state
    knownTasks.clear()
    for (const task of msg.tasks) {
      knownTasks.set(task.id, task)
    }

    // Inject each notification into the Codex thread
    for (const text of notifications) {
      emitCodexAppServerLog('info', 'listen-codex', 'task.notification', {
        notification: text,
      })
      injectMessage({ sender: 'meet-ai', content: text })
    }

    return true
  }

  const onMessage = (msg: ListenMessage) => {
    if (terminal.handle(msg)) return
    if (handleTasksInfo(msg)) return
    if (!isPlainChatMessage(msg)) return
    if (isHookAnchorMessage(msg)) return

    if (msg.id && msg.room_id && (msg.attachment_count ?? 0) > 0) {
      void downloadMessageAttachments(client, msg.room_id, msg.id).then(paths => {
        const createdAt = (msg as Message & { created_at?: string }).created_at
        emitCodexAppServerLog('info', 'listen-codex', 'room_message.received', {
          sender: msg.sender,
          createdAt: createdAt ?? new Date().toISOString(),
          attachmentCount: paths.length,
          contentPreview: msg.content.slice(0, 200),
        })
        injectMessage({
          sender: msg.sender,
          content: msg.content,
          attachments: paths,
        })
      })
      return
    }

    const createdAt = (msg as Message & { created_at?: string }).created_at
    emitCodexAppServerLog('info', 'listen-codex', 'room_message.received', {
      sender: msg.sender,
      createdAt: createdAt ?? new Date().toISOString(),
      attachmentCount: 0,
      contentPreview: msg.content.slice(0, 200),
    })
    injectMessage({
      sender: msg.sender,
      content: msg.content,
    })
  }

  const ws = client.listen(roomId, { exclude, senderType, onMessage })
  void codexBridge
    .start()
    .catch(() => {})
    .then(() => {
      const codexModel = codexBridge.getCurrentModel() ?? undefined
      return resolveCodexTeamName(roomId)
        .then(teamName =>
          teamMemberRegistrar({
            roomId,
            teamName,
            agentName: codexSender,
            role: 'codex',
            model: codexModel,
          })
        )
        .catch(() =>
          teamMemberRegistrar({ roomId, agentName: codexSender, role: 'codex', model: codexModel })
        )
    })

  if (bootstrapPrompt) {
    const bootstrapRequest: Promise<CodexInjectionResult> =
      codexBridge.injectPrompt(bootstrapPrompt)

    void bootstrapRequest
      .then(result => {
        emitCodexAppServerLog('info', 'listen-codex', 'bootstrap.completed', {
          mode: result.mode,
          threadId: result.threadId,
          turnId: result.turnId,
        })
      })
      .catch(error => {
        emitCodexAppServerLog('error', 'listen-codex', 'bootstrap.failed', {
          error: describeCodexAppServerError(error),
        })
      })
  }

  function shutdown() {
    if (shutdownStarted) return
    shutdownStarted = true
    terminal.shutdown()
    codexBridge.setEventHandler(null)
    void codexBridge.close()
    if (ws.readyState === WebSocket.OPEN) {
      ws.close(1000, 'client shutdown')
    }
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
  process.on('SIGHUP', shutdown)

  return ws
}
