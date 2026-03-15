import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { downloadMessageAttachments } from '@meet-ai/cli/lib/attachments'
import { createHookClient, sendLogEntry, sendParentMessage } from '@meet-ai/cli/lib/hooks/client'
import { getHomeCredentials } from '@meet-ai/cli/lib/meetai-home'
import { emitPiLog } from '@meet-ai/cli/lib/pi-evlog'
import {
  createPiBridge,
  type PiBridge,
  type PiAgentEvent,
  type PiExtensionUIRequest,
} from '@meet-ai/cli/lib/pi-rpc'
import {
  requestRoomQuestionReview,
  type QuestionReviewQuestion,
} from '@meet-ai/cli/lib/question-review'
import {
  registerActiveTeamMember,
  type TeamMemberRegistrar,
} from '@meet-ai/cli/lib/team-member-registration'
import { findPiCli } from '@meet-ai/cli/spawner'
import { ListenInput } from './schema'
import { createTerminalControlHandler, isHookAnchorMessage, type ListenMessage } from './shared'
import type { MeetAiClient } from '@meet-ai/cli/types'

function isPlainChatMessage(msg: ListenMessage): boolean {
  return msg.type == null || msg.type === 'message'
}

function normalizeFinalText(value: string): string {
  return value.replace(/\r\n/g, '\n').trim()
}

function previewText(value: string, limit = 120): string {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (normalized.length <= limit) return normalized
  return `${normalized.slice(0, limit)}...`
}

// --- Tool summary formatting ---

function truncate(value: string, max: number): string {
  if (value.length <= max) return value
  return `${value.slice(0, max)}…`
}

function formatToolSummary(toolName: string, args: unknown): string {
  const a = args as Record<string, unknown> | null
  if (!a || typeof a !== 'object') return toolName

  switch (toolName) {
    case 'read': {
      return `Read ${a.path ?? ''}`
    }
    case 'bash': {
      const cmd = typeof a.command === 'string' ? truncate(a.command, 120) : ''
      return `Bash ${cmd}`
    }
    case 'edit': {
      return `Edit ${a.path ?? ''}`
    }
    case 'write': {
      return `Write ${a.path ?? ''}`
    }
    case 'find': {
      return `Find ${a.path ?? '.'} ${a.pattern ?? ''}`
    }
    case 'grep': {
      return `Grep ${a.pattern ?? ''} ${a.path ?? ''}`
    }
    case 'ls': {
      return `Ls ${a.path ?? '.'}`
    }
    default: {
      // For task/canvas tools, show the tool name + first string arg
      const firstArg = Object.values(a).find(v => typeof v === 'string')
      return firstArg ? `${toolName} ${truncate(String(firstArg), 80)}` : toolName
    }
  }
}

// --- Task notification types (shared with listen-codex) ---

type TaskItem = {
  id: string
  subject: string
  description?: string
  status: 'pending' | 'in_progress' | 'completed'
  assignee: string | null
  owner: string | null
  source: 'claude' | 'codex' | 'pi' | 'meet_ai'
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
      notifications.push(`New task assigned to you:\n${formatTaskPayload(task)}`)
      continue
    }

    const wasAssignedToMe =
      old.assignee != null && old.assignee.toLowerCase() === agentName.toLowerCase()

    if (!wasAssignedToMe) {
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

/** Resolve paths to Pi extensions bundled with this package. */
function resolvePiExtensionPath(name: string): string {
  const thisDir = fileURLToPath(new URL('.', import.meta.url))
  // From commands/listen/ → lib/pi-extensions/<name>.ts
  return join(thisDir, '..', '..', 'lib', 'pi-extensions', `${name}.ts`)
}

const IMAGE_MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
}

function readImageAsBase64(filePath: string): { data: string; mimeType: string } | null {
  const ext = filePath.toLowerCase().slice(filePath.lastIndexOf('.'))
  const mimeType = IMAGE_MIME_TYPES[ext]
  if (!mimeType) return null
  try {
    const buffer = readFileSync(filePath)
    return { data: buffer.toString('base64'), mimeType }
  } catch {
    return null
  }
}

export function listenPi(
  client: MeetAiClient,
  input: {
    roomId?: string
    exclude?: string
    senderType?: string
    team?: string
    inbox?: string
  },
  piBridgeOverride?: PiBridge | null,
  teamMemberRegistrar: TeamMemberRegistrar = registerActiveTeamMember
): WebSocket {
  const parsed = ListenInput.parse(input)
  const { roomId, exclude, senderType, team, inbox } = parsed
  let shutdownStarted = false

  if (team || inbox) {
    const flags = [team ? '--team' : null, inbox ? '--inbox' : null].filter(Boolean).join(', ')
    throw new Error(
      `Pi listen does not support Claude inbox routing flags (${flags}). Run meet-ai listen without Claude-specific routing options.`
    )
  }

  const terminal = createTerminalControlHandler({ client, roomId })

  const homeCreds = getHomeCredentials()
  if (!homeCreds) throw new Error("No meet-ai credentials found. Run 'meet-ai' to set up.")
  const { url: meetAiUrl, key: meetAiKey } = homeCreds
  const hookClient = createHookClient(meetAiUrl, meetAiKey)
  let activityParentId: string | null = null
  let activityLogQueue: Promise<void> = Promise.resolve()

  const piSender = process.env.MEET_AI_AGENT_NAME?.trim() || 'pi'

  // Message buffering — accumulate text across deltas, publish on agent_end.
  // We clear the buffer immediately after capturing text for publish,
  // so the buffer itself acts as the "unpublished text" guard.
  // No boolean flags needed — this avoids the race condition where an
  // async publish from run N completes after run N+1's agent_start
  // resets the flags, re-setting messageSent=true and blocking run N+1.
  let messageBuffer = ''
  let publishQueue: Promise<void> = Promise.resolve()

  emitPiLog('info', 'listen-pi', 'session.starting', {
    roomId,
    exclude,
    senderType,
    piSender,
    cwd: process.cwd(),
  })

  const enqueuePublish = (task: () => Promise<void>) => {
    publishQueue = publishQueue.then(task, task).catch(error => {
      emitPiLog('error', 'listen-pi', 'room_publish.failed', {
        error: error instanceof Error ? error.message : String(error),
      })
    })
  }

  const enqueueActivityLog = (summary: string) => {
    if (!hookClient) return
    activityLogQueue = activityLogQueue
      .then(async () => {
        if (!activityParentId) {
          activityParentId = await sendParentMessage(hookClient, roomId)
        }
        await sendLogEntry(hookClient, roomId, summary, activityParentId ?? undefined, piSender)
      })
      .catch(error => {
        emitPiLog('error', 'listen-pi', 'activity_log.failed', {
          summary,
          error: error instanceof Error ? error.message : String(error),
        })
      })
  }

  const publishBufferedMessage = () => {
    const text = normalizeFinalText(messageBuffer)
    if (!text) return

    // Clear immediately — prevents re-sending the same text if a new
    // agent run starts before the async publish completes.
    messageBuffer = ''

    emitPiLog('info', 'listen-pi', 'room_publish.queued', {
      textLength: text.length,
      preview: previewText(text),
    })

    enqueuePublish(async () => {
      try {
        emitPiLog('info', 'listen-pi', 'room_publish.started', {
          textLength: text.length,
          preview: previewText(text),
        })
        await client.sendMessage(roomId, piSender, text)
        emitPiLog('info', 'listen-pi', 'room_publish.completed', {
          textLength: text.length,
          preview: previewText(text),
        })
      } catch (error) {
        emitPiLog('error', 'listen-pi', 'room_publish.send_failed', {
          textLength: text.length,
          error: error instanceof Error ? error.message : String(error),
        })
        throw error
      }
    })
  }

  // Create the Pi RPC bridge with task and canvas extensions
  const piBridge: PiBridge =
    piBridgeOverride ??
    createPiBridge(findPiCli(), process.cwd(), {
      extensions: [resolvePiExtensionPath('task-tools'), resolvePiExtensionPath('canvas-tools')],
    })

  piBridge.setEventHandler((event: PiAgentEvent) => {
    switch (event.type) {
      case 'message_update': {
        const delta = event.assistantMessageEvent
        if (delta.type === 'text_delta') {
          messageBuffer += delta.delta
          emitPiLog('debug', 'listen-pi', 'text_delta.received', {
            deltaLength: delta.delta.length,
            bufferLength: messageBuffer.length,
          })
        }
        break
      }

      case 'message_end': {
        // Extract final text from the completed assistant message
        if (event.message.role === 'assistant') {
          const finalText = event.message.content
            .filter(
              (block): block is { type: 'text'; text: string; textSignature?: string } =>
                block.type === 'text'
            )
            .map(block => block.text)
            .join('\n')
          if (finalText.trim()) {
            emitPiLog('info', 'listen-pi', 'message_end.received', {
              textLength: finalText.length,
              preview: previewText(finalText),
            })
            messageBuffer = finalText
          }
        }
        break
      }

      case 'tool_execution_start': {
        const toolSummary = formatToolSummary(event.toolName, event.args)
        emitPiLog('info', 'listen-pi', 'tool.started', {
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          summary: toolSummary,
        })
        enqueueActivityLog(toolSummary)
        break
      }

      case 'tool_execution_update': {
        emitPiLog('debug', 'listen-pi', 'tool.update', {
          toolCallId: event.toolCallId,
          toolName: event.toolName,
        })
        break
      }

      case 'tool_execution_end': {
        emitPiLog('info', 'listen-pi', 'tool.completed', {
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          isError: event.isError,
        })
        break
      }

      case 'agent_start': {
        emitPiLog('info', 'listen-pi', 'agent.started', {
          previousBufferLength: messageBuffer.length,
        })
        messageBuffer = ''
        break
      }

      case 'agent_end': {
        emitPiLog('info', 'listen-pi', 'agent.ended', {
          bufferLength: messageBuffer.length,
        })
        publishBufferedMessage()
        break
      }

      case 'turn_start': {
        emitPiLog('info', 'listen-pi', 'turn.started')
        break
      }

      case 'turn_end': {
        emitPiLog('info', 'listen-pi', 'turn.ended', {
          bufferLength: messageBuffer.length,
        })
        // Don't publish on turn_end — only publish on agent_end.
        // Publishing here causes the messageSent flag to block the final
        // response text when Pi emits preliminary text (e.g. "Let me
        // check...") in an earlier turn before calling tools.
        break
      }

      default: {
        break
      }
    }
  })

  // --- Extension UI request handler (question review) ---
  piBridge.setUiRequestHandler((request: PiExtensionUIRequest) => {
    // Only handle dialog methods that expect a response
    if (request.method === 'select') {
      emitPiLog('info', 'listen-pi', 'ui_request.select', {
        id: request.id,
        title: request.title,
        optionCount: request.options.length,
      })
      const questions: QuestionReviewQuestion[] = [
        {
          question: request.title,
          options: request.options.map(label => ({ label })),
        },
      ]
      void requestRoomQuestionReview(hookClient, roomId, questions)
        .then(result => {
          if (result.status === 'answered') {
            const answer = Object.values(result.answers)[0]
            piBridge.sendUiResponse({ id: request.id, value: answer ?? request.options[0] })
          } else {
            piBridge.sendUiResponse({ id: request.id, cancelled: true })
          }
        })
        .catch(() => {
          piBridge.sendUiResponse({ id: request.id, cancelled: true })
        })
      return
    }

    if (request.method === 'confirm') {
      emitPiLog('info', 'listen-pi', 'ui_request.confirm', {
        id: request.id,
        title: request.title,
        message: request.message,
      })
      const questions: QuestionReviewQuestion[] = [
        {
          question: `${request.title}\n${request.message}`,
          options: [{ label: 'Yes' }, { label: 'No' }],
        },
      ]
      void requestRoomQuestionReview(hookClient, roomId, questions)
        .then(result => {
          if (result.status === 'answered') {
            const answer = Object.values(result.answers)[0]
            piBridge.sendUiResponse({ id: request.id, confirmed: answer?.toLowerCase() === 'yes' })
          } else {
            piBridge.sendUiResponse({ id: request.id, cancelled: true })
          }
        })
        .catch(() => {
          piBridge.sendUiResponse({ id: request.id, cancelled: true })
        })
      return
    }

    // For input/editor — cancel since room UI only supports choice-based questions
    if (request.method === 'input' || request.method === 'editor') {
      emitPiLog('info', 'listen-pi', 'ui_request.unsupported_dialog', {
        id: request.id,
        method: request.method,
        title: request.title,
      })
      piBridge.sendUiResponse({ id: request.id, cancelled: true })
      return
    }

    // Fire-and-forget methods — no response needed
    if (request.method === 'notify') {
      emitPiLog('info', 'listen-pi', 'ui_request.notify', {
        message: request.message,
        notifyType: request.notifyType ?? 'info',
      })
    }
  })

  // --- Task notification state ---
  const knownTasks = new Map<string, TaskItem>()
  let isFirstTasksInfo = true

  const handleTasksInfo = (msg: ListenMessage): boolean => {
    if (!isTasksInfoMessage(msg)) return false

    // First tasks_info is the cached snapshot — use as baseline without notifications
    if (isFirstTasksInfo) {
      isFirstTasksInfo = false
      for (const task of msg.tasks) {
        knownTasks.set(task.id, task)
      }
      return true
    }

    const notifications = diffTasks(knownTasks, msg.tasks, piSender)

    // Update cache with latest state
    knownTasks.clear()
    for (const task of msg.tasks) {
      knownTasks.set(task.id, task)
    }

    // Inject each notification into the Pi session
    for (const text of notifications) {
      emitPiLog('info', 'listen-pi', 'task.notification', {
        notification: text,
      })
      injectMessage({ sender: 'meet-ai', content: text })
    }

    return true
  }

  const injectMessage = (message: {
    sender: string
    content: string
    images?: { type: 'image'; data: string; mimeType: string }[]
  }) => {
    const text = `[${message.sender}]: ${message.content}`
    const isStreaming = piBridge.isStreaming
    emitPiLog('info', 'listen-pi', 'injection.started', {
      sender: message.sender,
      contentLength: message.content.length,
      contentPreview: previewText(message.content, 200),
      imageCount: message.images?.length ?? 0,
      isStreaming,
      mode: isStreaming ? 'follow_up' : 'prompt',
    })
    // inject() is serialized and streaming-aware:
    // - idle  → prompt (starts a new agent run)
    // - busy  → follow_up (queued, delivered after current run finishes)
    void piBridge
      .inject(text, message.images)
      .then(() => {
        emitPiLog('info', 'listen-pi', 'injection.completed', {
          sender: message.sender,
          mode: isStreaming ? 'follow_up' : 'prompt',
        })
      })
      .catch(error => {
        emitPiLog('error', 'listen-pi', 'injection.failed', {
          sender: message.sender,
          error: error instanceof Error ? error.message : String(error),
        })
      })
  }

  const onMessage = (msg: ListenMessage) => {
    if (terminal.handle(msg)) return
    if (handleTasksInfo(msg)) return
    if (!isPlainChatMessage(msg)) return
    if (isHookAnchorMessage(msg)) return

    emitPiLog('info', 'listen-pi', 'room_message.received', {
      sender: msg.sender,
      contentLength: msg.content.length,
      contentPreview: previewText(msg.content, 200),
      attachmentCount: msg.attachment_count ?? 0,
    })

    if (msg.id && msg.room_id && (msg.attachment_count ?? 0) > 0) {
      void downloadMessageAttachments(client, msg.room_id, msg.id).then(paths => {
        const images: { type: 'image'; data: string; mimeType: string }[] = []
        const nonImagePaths: string[] = []

        for (const filePath of paths) {
          const img = readImageAsBase64(filePath)
          if (img) {
            images.push({ type: 'image', data: img.data, mimeType: img.mimeType })
          } else {
            nonImagePaths.push(filePath)
          }
        }

        emitPiLog('info', 'listen-pi', 'attachments.downloaded', {
          sender: msg.sender,
          imageCount: images.length,
          nonImageCount: nonImagePaths.length,
          paths,
        })

        const attachmentNote =
          nonImagePaths.length > 0
            ? `\n(Non-image attachments downloaded to: ${nonImagePaths.join(', ')})`
            : ''

        injectMessage({
          sender: msg.sender,
          content: msg.content + attachmentNote,
          images: images.length > 0 ? images : undefined,
        })
      })
      return
    }

    injectMessage({
      sender: msg.sender,
      content: msg.content,
    })
  }

  const ws = client.listen(roomId, { exclude, senderType, onMessage })

  // Start the Pi bridge and register as team member
  emitPiLog('info', 'pi-rpc', 'process.spawn', {
    cwd: process.cwd(),
    piSender,
  })

  void piBridge
    .start()
    .then(() => {
      const piModel = piBridge.getCurrentModel() ?? undefined
      emitPiLog('info', 'listen-pi', 'bridge.started', {
        model: piModel ?? null,
        piSender,
      })
      return teamMemberRegistrar({
        roomId,
        agentName: piSender,
        role: 'pi',
        model: piModel,
      })
    })
    .then(() => {
      emitPiLog('info', 'listen-pi', 'team_member.registered', {
        roomId,
        agentName: piSender,
      })
    })
    .catch(error => {
      emitPiLog('error', 'listen-pi', 'bridge.start_failed', {
        error: error instanceof Error ? error.message : String(error),
      })
    })

  // If there's a bootstrap prompt, send it
  const bootstrapPrompt = process.env.MEET_AI_PI_BOOTSTRAP_PROMPT?.trim()
  if (bootstrapPrompt) {
    emitPiLog('info', 'listen-pi', 'bootstrap.sending', {
      promptLength: bootstrapPrompt.length,
    })
    void piBridge
      .sendPrompt(bootstrapPrompt)
      .then(() => {
        emitPiLog('info', 'listen-pi', 'bootstrap.completed', {
          promptLength: bootstrapPrompt.length,
        })
      })
      .catch(error => {
        emitPiLog('error', 'listen-pi', 'bootstrap.failed', {
          error: error instanceof Error ? error.message : String(error),
        })
      })
  }

  function shutdown() {
    if (shutdownStarted) return
    shutdownStarted = true
    emitPiLog('info', 'listen-pi', 'session.shutdown', {
      roomId,
      piSender,
    })
    terminal.shutdown()
    piBridge.setEventHandler(null)
    piBridge.setUiRequestHandler(null)
    void piBridge.close()
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
