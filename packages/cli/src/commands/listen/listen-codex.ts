import { downloadMessageAttachments } from '@meet-ai/cli/lib/attachments'
import { appendCodexInboxEntry } from '@meet-ai/cli/lib/codex'
import {
  type CodexAppServerEvent,
  type CodexBridge,
  type CodexInjectionResult,
  createCodexAppServerBridge,
  describeCodexAppServerError,
} from '@meet-ai/cli/lib/codex-app-server'
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

function isTruthyEnv(value: string | undefined): boolean {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

function normalizeFinalText(value: string): string {
  return value.replace(/\r\n/g, '\n').trim()
}

function makeMessageKey(event: { turnId: string | null; itemId: string | null }): string {
  return event.itemId ?? event.turnId ?? 'unknown'
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
  const codexBridge: CodexBridge =
    codexBridgeOverride ??
    createCodexAppServerBridge({
      threadId: null,
      cwd: process.cwd(),
      experimentalApi: isTruthyEnv(process.env.MEET_AI_CODEX_APP_SERVER_EXPERIMENTAL),
    })
  const bootstrapPrompt = process.env.MEET_AI_CODEX_BOOTSTRAP_PROMPT?.trim()
  const codexSender = process.env.MEET_AI_AGENT_NAME?.trim() || 'codex'
  const messageState = new Map<string, { turnId: string | null; text: string; sent: boolean; sending: boolean }>()
  let publishQueue: Promise<void> = Promise.resolve()

  const enqueuePublish = (task: () => Promise<void>) => {
    publishQueue = publishQueue.then(task, task).catch(error => {
      console.error(`meet-ai: failed to publish Codex output to room: ${error instanceof Error ? error.message : String(error)}`)
    })
  }

  const publishBufferedMessage = (key: string) => {
    const state = messageState.get(key)
    const text = normalizeFinalText(state?.text ?? '')
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
    const key = makeMessageKey(event)
    const nextText = event.text.replace(/\r\n/g, '\n')
    if (!nextText) return

    const existing = messageState.get(key)
    if (!existing) {
      messageState.set(key, { turnId: event.turnId, text: nextText, sent: false, sending: false })
      return
    }

    existing.turnId = event.turnId ?? existing.turnId

    if (event.type === 'agent_message_completed') {
      existing.text = nextText
      return
    }

    existing.text += nextText
  }

  codexBridge.setEventHandler((event) => {
    if (event.type === 'agent_message_delta' || event.type === 'agent_message_completed') {
      mergeEventText(event)
      if (event.type === 'agent_message_completed') {
        publishBufferedMessage(makeMessageKey(event))
      }
      return
    }

    if (event.type === 'turn_completed') {
      for (const [key, state] of messageState.entries()) {
        if (state.turnId === event.turnId || (!event.turnId && !state.sent)) {
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

  const onMessage = (msg: ListenMessage) => {
    if (terminal.handle(msg)) return

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
