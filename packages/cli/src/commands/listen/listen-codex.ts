import { downloadMessageAttachments } from '@meet-ai/cli/lib/attachments'
import { appendCodexInboxEntry, readCurrentCodexSessionId } from '@meet-ai/cli/lib/codex'
import {
  type CodexAppServerEvent,
  type CodexBridge,
  type CodexInjectionResult,
  createCodexAppServerBridge,
  describeCodexAppServerError,
} from '@meet-ai/cli/lib/codex-app-server'
import { TASK_TOOL_SPECS, createTaskToolCallHandler } from '@meet-ai/cli/lib/codex-task-tools'
import { emitCodexAppServerLog } from '@meet-ai/cli/lib/codex-app-server-evlog'
import { createHookClient } from '@meet-ai/cli/lib/hooks/client'
import { findRoom } from '@meet-ai/cli/lib/hooks/find-room'
import { createTask, updateTask, listTasks, getTask } from '@meet-ai/cli/lib/hooks/tasks'
import {
  registerActiveTeamMember,
  type TeamMemberRegistrar,
} from '@meet-ai/cli/lib/team-member-registration'
import { ListenInput } from './schema'
import { createTerminalControlHandler, isHookAnchorMessage, type ListenMessage } from './shared'
import type { MeetAiClient, Message } from '@meet-ai/cli/types'


function normalizeFinalText(value: string): string {
  return value.replace(/\r\n/g, '\n').trim()
}

function previewText(value: string, limit = 120): string {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (normalized.length <= limit) return normalized
  return `${normalized.slice(0, limit)}...`
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

function diffTasks(
  prev: Map<string, TaskItem>,
  next: TaskItem[],
  agentName: string
): string[] {
  const notifications: string[] = []

  for (const task of next) {
    const isAssignedToMe =
      task.assignee != null &&
      task.assignee.toLowerCase() === agentName.toLowerCase()
    if (!isAssignedToMe) continue

    const old = prev.get(task.id)

    if (!old) {
      // Newly visible task assigned to this agent
      notifications.push(
        `New task assigned to you:\n${formatTaskPayload(task)}`
      )
      continue
    }

    const wasAssignedToMe =
      old.assignee != null &&
      old.assignee.toLowerCase() === agentName.toLowerCase()

    if (!wasAssignedToMe) {
      // Task reassigned to this agent
      notifications.push(
        `Task assigned to you:\n${formatTaskPayload(task)}`
      )
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
  teamMemberRegistrar: TeamMemberRegistrar = registerActiveTeamMember
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

  const meetAiUrl = process.env.MEET_AI_URL ?? ''
  const meetAiKey = process.env.MEET_AI_KEY ?? ''
  const hookClient = meetAiUrl && meetAiKey ? createHookClient(meetAiUrl, meetAiKey) : null
  const taskToolCallHandler = hookClient && roomId
    ? createTaskToolCallHandler({
        createTask: params => createTask(hookClient, roomId, { ...params, source: 'codex' }),
        updateTask: (taskId, params) => updateTask(hookClient, roomId, taskId, { ...params, source: 'codex' }),
        listTasks: filters => listTasks(hookClient, roomId, filters),
        getTask: taskId => getTask(hookClient, roomId, taskId),
      })
    : undefined

  const codexBridge: CodexBridge =
    codexBridgeOverride ??
    createCodexAppServerBridge({
      threadId: null,
      cwd: process.cwd(),
      experimentalApi: true,
      ...(taskToolCallHandler ? { dynamicTools: TASK_TOOL_SPECS, toolCallHandler: taskToolCallHandler } : {}),
    })
  const bootstrapPrompt = process.env.MEET_AI_CODEX_BOOTSTRAP_PROMPT?.trim()
  const codexSender = process.env.MEET_AI_AGENT_NAME?.trim() || 'codex'
  const messageState = new Map<string, TurnMessageState>()
  let publishQueue: Promise<void> = Promise.resolve()

  const enqueuePublish = (task: () => Promise<void>) => {
    publishQueue = publishQueue.then(task, task).catch(error => {
      console.error(`meet-ai: failed to publish Codex output to room: ${error instanceof Error ? error.message : String(error)}`)
    })
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

  const mergeEventText = (event: Extract<CodexAppServerEvent, { type: 'agent_message_delta' | 'agent_message_completed' }>) => {
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

  codexBridge.setEventHandler((event) => {
    if (event.type === 'agent_message_delta' || event.type === 'agent_message_completed') {
      mergeEventText(event)
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

  const injectMessage = (message: {
    sender: string
    content: string
    attachments?: string[]
  }) => {
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
  const codexModel = codexBridge.getCurrentModel() ?? undefined
  void resolveCodexTeamName(roomId)
    .then(teamName => teamMemberRegistrar({ roomId, teamName, agentName: codexSender, role: 'codex', model: codexModel }))
    .catch(() => teamMemberRegistrar({ roomId, agentName: codexSender, role: 'codex', model: codexModel }))

  if (bootstrapPrompt) {
    const bootstrapRequest: Promise<CodexInjectionResult> = codexBridge.injectPrompt(bootstrapPrompt)

    void bootstrapRequest
      .then((result) => {
        emitCodexAppServerLog('info', 'listen-codex', 'bootstrap.completed', {
          mode: result.mode,
          threadId: result.threadId,
          turnId: result.turnId,
        })
      })
      .catch((error) => {
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
