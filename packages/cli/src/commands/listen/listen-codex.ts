import { downloadMessageAttachments } from '@meet-ai/cli/lib/attachments'
import { appendCodexInboxEntry } from '@meet-ai/cli/lib/codex'
import {
  type CodexAppServerEvent,
  type CodexBridge,
  type CodexInjectionResult,
  createCodexAppServerBridge,
  describeCodexAppServerError,
} from '@meet-ai/cli/lib/codex-app-server'
import { TASK_TOOL_SPECS, createTaskToolCallHandler } from '@meet-ai/cli/lib/codex-task-tools'
import { createHookClient } from '@meet-ai/cli/lib/hooks/client'
import { createTask, updateTask, listTasks, getTask } from '@meet-ai/cli/lib/hooks/tasks'
import { ListenInput } from './schema'
import { createTerminalControlHandler, type ListenMessage } from './shared'
import type { MeetAiClient, Message } from '@meet-ai/cli/types'

function formatCodexListenOutput(
  msg: Message & { created_at?: string; attachments?: string[] }
): string {
  const lines = [
    `[meet-ai] ${msg.sender} ${msg.created_at ?? new Date().toISOString()}`,
    msg.content,
  ]

  if (msg.attachments?.length) {
    lines.push(`attachments: ${msg.attachments.join(', ')}`)
  }

  return `${lines.join('\n')}\n`
}

function formatCodexInjectionOutput(result: { mode: 'start' | 'steer'; turnId: string }): string {
  return `[meet-ai->codex] ${result.mode} ${result.turnId}\n`
}


function normalizeFinalText(value: string): string {
  return value.replace(/\r\n/g, '\n').trim()
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
        `New task assigned to you: ${task.subject} (status: ${task.status})`
      )
      continue
    }

    const wasAssignedToMe =
      old.assignee != null &&
      old.assignee.toLowerCase() === agentName.toLowerCase()

    if (!wasAssignedToMe) {
      // Task reassigned to this agent
      notifications.push(
        `Task assigned to you: ${task.subject} (status: ${task.status})`
      )
      continue
    }

    if (old.status !== task.status) {
      notifications.push(
        `Task status changed: ${task.subject} (${old.status} → ${task.status})`
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

export function listenCodex(
  client: MeetAiClient,
  input: {
    roomId?: string
    exclude?: string
    senderType?: string
    team?: string
    inbox?: string
  },
  codexBridgeOverride?: CodexBridge | null
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
  const taskToolCallHandler = hookClient
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

    state.sending = true
    enqueuePublish(async () => {
      try {
        await client.sendMessage(roomId, codexSender, text)
        state.sent = true
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
      return
    }

    if (!existing.itemTexts.has(itemKey)) existing.itemOrder.push(itemKey)

    if (event.type === 'agent_message_completed') {
      existing.itemTexts.set(itemKey, nextText)
      return
    }

    existing.itemTexts.set(itemKey, `${existing.itemTexts.get(itemKey) ?? ''}${nextText}`)
  }

  codexBridge.setEventHandler((event) => {
    if (event.type === 'agent_message_delta' || event.type === 'agent_message_completed') {
      mergeEventText(event)
      return
    }

    if (event.type === 'turn_completed') {
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
        console.log(formatCodexInjectionOutput(result))
      })
      .catch(error => {
        console.error(describeCodexAppServerError(error))
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
      console.log(`[meet-ai:tasks] ${text}\n`)
      injectMessage({ sender: 'meet-ai', content: text })
    }

    return true
  }

  const onMessage = (msg: ListenMessage) => {
    if (terminal.handle(msg)) return
    if (handleTasksInfo(msg)) return
    if (!isPlainChatMessage(msg)) return

    if (msg.id && msg.room_id && (msg.attachment_count ?? 0) > 0) {
      void downloadMessageAttachments(client, msg.room_id, msg.id).then(paths => {
        const output = paths.length ? { ...msg, attachments: paths } : msg
        console.log(
          formatCodexListenOutput(output as Message & { created_at?: string; attachments?: string[] })
        )
        injectMessage({
          sender: msg.sender,
          content: msg.content,
          attachments: paths,
        })
      })
      return
    }

    console.log(formatCodexListenOutput(msg as Message & { created_at?: string }))
    injectMessage({
      sender: msg.sender,
      content: msg.content,
    })
  }

  const ws = client.listen(roomId, { exclude, senderType, onMessage })

  if (bootstrapPrompt) {
    const bootstrapRequest: Promise<CodexInjectionResult> = codexBridge.injectPrompt(bootstrapPrompt)

    void bootstrapRequest
      .then((result) => {
        console.log(formatCodexInjectionOutput(result))
      })
      .catch((error) => {
        console.error(describeCodexAppServerError(error))
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
