import {
  spawn,
  type ChildProcessWithoutNullStreams,
  type SpawnOptionsWithoutStdio,
} from 'node:child_process'
import { stderr } from 'node:process'
import { createInterface, type Interface as ReadLineInterface } from 'node:readline'
import type { AgentMessageDeltaNotification } from '@meet-ai/cli/generated/codex-app-server/v2/AgentMessageDeltaNotification'
import type { ItemCompletedNotification } from '@meet-ai/cli/generated/codex-app-server/v2/ItemCompletedNotification'
import type { Thread } from '@meet-ai/cli/generated/codex-app-server/v2/Thread'
import type { ThreadStartedNotification } from '@meet-ai/cli/generated/codex-app-server/v2/ThreadStartedNotification'
import type { Turn } from '@meet-ai/cli/generated/codex-app-server/v2/Turn'
import type { TurnCompletedNotification } from '@meet-ai/cli/generated/codex-app-server/v2/TurnCompletedNotification'
import type { TurnStartedNotification } from '@meet-ai/cli/generated/codex-app-server/v2/TurnStartedNotification'

export type CodexAppServerTextInput = {
  sender: string
  content: string
  timestamp?: string
  attachments?: string[]
}

type JsonRpcRequest = {
  method: string
  id: string | number
  params?: unknown
}

type JsonRpcNotification = {
  method: string
  params?: unknown
}

type JsonRpcResponse = {
  id: string | number
  result?: unknown
  error?: {
    code?: number
    message?: string
    data?: unknown
  }
}

type JsonRpcServerRequest = JsonRpcRequest

type PendingRequest = {
  resolve: (value: unknown) => void
  reject: (reason?: unknown) => void
}

type SpawnFn = (
  command: string,
  args: string[],
  options: SpawnOptionsWithoutStdio
) => ChildProcessWithoutNullStreams

export type CodexAppServerBridgeOptions = {
  threadId?: string | null
  cwd?: string
  codexBin?: string
  clientName?: string
  clientTitle?: string
  clientVersion?: string
  experimentalApi?: boolean
  env?: NodeJS.ProcessEnv
  spawnFn?: SpawnFn
  stderr?: Pick<NodeJS.WritableStream, 'write'>
}

export type CodexInjectionResult = {
  mode: 'start' | 'steer'
  threadId: string
  turnId: string
}

export type CodexAppServerEvent =
  | {
      type: 'agent_message_delta'
      itemId: string | null
      turnId: string | null
      text: string
    }
  | {
      type: 'agent_message_completed'
      itemId: string | null
      turnId: string | null
      text: string
    }
  | {
      type: 'turn_completed'
      turnId: string | null
    }

export interface CodexBridge {
  injectText(input: CodexAppServerTextInput): Promise<CodexInjectionResult>
  injectPrompt(text: string): Promise<CodexInjectionResult>
  close(): Promise<void>
  setEventHandler(handler: ((event: CodexAppServerEvent) => void) | null): void
}

type CodexThreadResponse = {
  thread?: Thread
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isJsonRpcResponse(value: unknown): value is JsonRpcResponse {
  return isObject(value) && 'id' in value && ('result' in value || 'error' in value)
}

function isJsonRpcServerRequest(value: unknown): value is JsonRpcServerRequest {
  return (
    isObject(value) &&
    typeof value.method === 'string' &&
    'id' in value &&
    !('result' in value) &&
    !('error' in value)
  )
}

function isJsonRpcNotification(value: unknown): value is JsonRpcNotification {
  return isObject(value) && typeof value.method === 'string' && !('id' in value)
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

function formatRoomMessageForCodex(input: CodexAppServerTextInput): string {
  const lines = [
    `New message from meet-ai sender "${input.sender}" at ${input.timestamp ?? new Date().toISOString()}:`,
    '',
    input.content,
  ]

  if (input.attachments?.length) {
    lines.push('', `Attachments: ${input.attachments.join(', ')}`)
  }

  return lines.join('\n')
}

function maybeActiveTurnId(thread: Thread | null | undefined): string | null {
  if (!thread || !Array.isArray(thread.turns)) return null

  for (let index = thread.turns.length - 1; index >= 0; index -= 1) {
    const turn = thread.turns[index] as Turn | undefined
    if (turn?.status === 'inProgress' && typeof turn.id === 'string') {
      return turn.id
    }
  }

  return null
}

function isSteerPreconditionError(error: unknown): boolean {
  if (!isObject(error)) return false
  const message = typeof error.message === 'string' ? error.message.toLowerCase() : ''
  return (
    message.includes('expected') ||
    message.includes('active turn') ||
    message.includes('precondition')
  )
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function isAgentMessageDeltaNotification(params: unknown): params is AgentMessageDeltaNotification {
  return (
    isObject(params) &&
    typeof params.threadId === 'string' &&
    typeof params.turnId === 'string' &&
    typeof params.itemId === 'string' &&
    typeof params.delta === 'string'
  )
}

function extractAgentMessageDelta(params: unknown): {
  itemId: string | null
  turnId: string | null
  text: string | null
} {
  if (!isAgentMessageDeltaNotification(params)) {
    return { itemId: null, turnId: null, text: null }
  }

  return {
    itemId: params.itemId,
    turnId: params.turnId,
    text: params.delta,
  }
}

function isItemCompletedNotification(params: unknown): params is ItemCompletedNotification {
  return (
    isObject(params) &&
    typeof params.threadId === 'string' &&
    typeof params.turnId === 'string' &&
    isObject(params.item) &&
    typeof params.item.type === 'string' &&
    typeof params.item.id === 'string'
  )
}

function extractCompletedAgentMessage(params: unknown): {
  itemId: string | null
  turnId: string | null
  text: string | null
} | null {
  if (!isItemCompletedNotification(params)) return null
  if (params.item.type !== 'agentMessage') return null

  return {
    itemId: params.item.id,
    turnId: params.turnId,
    text: params.item.text,
  }
}

function isThreadStartedNotification(params: unknown): params is ThreadStartedNotification {
  return isObject(params) && isObject(params.thread) && typeof params.thread.id === 'string'
}

function isTurnStartedNotification(params: unknown): params is TurnStartedNotification {
  return (
    isObject(params) &&
    typeof params.threadId === 'string' &&
    isObject(params.turn) &&
    typeof params.turn.id === 'string'
  )
}

function isTurnCompletedNotification(params: unknown): params is TurnCompletedNotification {
  return (
    isObject(params) &&
    typeof params.threadId === 'string' &&
    isObject(params.turn) &&
    typeof params.turn.id === 'string'
  )
}

function matchesActiveThread(threadId: string | null, params: unknown): boolean {
  if (!threadId || !isObject(params) || typeof params.threadId !== 'string') return false
  return params.threadId === threadId
}

export class CodexAppServerBridge {
  private threadId: string | null
  private readonly cwd?: string
  private readonly codexBin: string
  private readonly clientName: string
  private readonly clientTitle: string
  private readonly clientVersion: string
  private readonly experimentalApi: boolean
  private readonly env: NodeJS.ProcessEnv
  private readonly spawnFn: SpawnFn
  private readonly stderrStream: Pick<NodeJS.WritableStream, 'write'>

  private child: ChildProcessWithoutNullStreams | null = null
  private stdoutReader: ReadLineInterface | null = null
  private readyPromise: Promise<void> | null = null
  private pendingRequests = new Map<string | number, PendingRequest>()
  private nextRequestId = 1
  private activeTurnId: string | null = null
  private injectionQueue: Promise<unknown> = Promise.resolve()
  private eventHandler: ((event: CodexAppServerEvent) => void) | null = null

  constructor(options: CodexAppServerBridgeOptions) {
    this.threadId = options.threadId ?? null
    this.cwd = options.cwd
    this.codexBin =
      options.codexBin ??
      options.env?.MEET_AI_CODEX_PATH ??
      process.env.MEET_AI_CODEX_PATH ??
      'codex'
    this.clientName = options.clientName ?? 'meet_ai'
    this.clientTitle = options.clientTitle ?? 'meet-ai CLI'
    this.clientVersion = options.clientVersion ?? '0.0.0'
    this.experimentalApi = options.experimentalApi ?? false
    this.env = options.env ?? process.env
    this.spawnFn = options.spawnFn ?? spawn
    this.stderrStream = options.stderr ?? stderr
  }

  async start(): Promise<void> {
    if (!this.readyPromise) {
      this.readyPromise = this.startInternal().catch(error => {
        this.readyPromise = null
        throw error
      })
    }

    return this.readyPromise
  }

  async injectText(input: CodexAppServerTextInput): Promise<CodexInjectionResult> {
    const text = formatRoomMessageForCodex(input)
    return this.injectPrompt(text)
  }

  async injectPrompt(text: string): Promise<CodexInjectionResult> {
    return this.enqueue(async () => {
      await this.start()
      const payload = [{ type: 'text', text, text_elements: [] }]
      const threadId = this.threadId
      if (!threadId) {
        throw new Error('Codex app-server bridge does not have an active thread')
      }

      if (this.activeTurnId) {
        try {
          const result = await this.request<{ turnId: string }>('turn/steer', {
            threadId,
            input: payload,
            expectedTurnId: this.activeTurnId,
          })
          this.activeTurnId = result.turnId
          return { mode: 'steer' as const, threadId, turnId: result.turnId }
        } catch (error) {
          if (!isSteerPreconditionError(error)) throw error
          this.activeTurnId = null
        }
      }

      const result = await this.request<{ turn: { id: string } }>('turn/start', {
        threadId,
        input: payload,
      })
      this.activeTurnId = result.turn.id
      return { mode: 'start' as const, threadId, turnId: result.turn.id }
    })
  }

  getThreadId(): string | null {
    return this.threadId
  }

  async close(): Promise<void> {
    this.readyPromise = null
    this.activeTurnId = null

    if (this.stdoutReader) {
      this.stdoutReader.close()
      this.stdoutReader = null
    }

    const child = this.child
    this.child = null
    if (!child) return

    for (const pending of this.pendingRequests.values()) {
      pending.reject(new Error('Codex app-server bridge closed'))
    }
    this.pendingRequests.clear()

    child.kill()
  }

  setEventHandler(handler: ((event: CodexAppServerEvent) => void) | null): void {
    this.eventHandler = handler
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.injectionQueue.then(fn, fn)
    this.injectionQueue = next.catch(() => undefined)
    return next
  }

  private async startInternal(): Promise<void> {
    const child = this.spawnFn(
      this.codexBin,
      [
        'app-server',
        '--enable',
        'multi_agent',
        '--enable',
        'memories',
        '--enable',
        'realtime_conversation',
        '-c',
        'sandbox_mode="workspace-write"',
        '-c',
        'sandbox_workspace_write.network_access=true',
        '-c',
        'web_search="live"',
        '--listen',
        'stdio://',
      ],
      {
        cwd: this.cwd,
        env: this.env,
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    )

    this.child = child
    this.stdoutReader = createInterface({ input: child.stdout })

    this.stdoutReader.on('line', line => {
      void this.handleLine(line)
    })

    child.stderr.on('data', chunk => {
      this.stderrStream.write(chunk)
    })

    child.on('exit', (_code, signal) => {
      const reason = new Error(`codex app-server exited${signal ? ` with signal ${signal}` : ''}`)
      for (const pending of this.pendingRequests.values()) {
        pending.reject(reason)
      }
      this.pendingRequests.clear()
      this.child = null
      this.stdoutReader = null
      this.readyPromise = null
    })

    await this.request('initialize', {
      clientInfo: {
        name: this.clientName,
        title: this.clientTitle,
        version: this.clientVersion,
      },
      capabilities: {
        experimentalApi: this.experimentalApi,
      },
    })
    this.notify('initialized')

    if (this.threadId) {
      const resumeParams: Record<string, unknown> = {
        threadId: this.threadId,
        persistExtendedHistory: this.experimentalApi,
      }

      try {
        const resumeResult = await this.request<CodexThreadResponse>('thread/resume', resumeParams)
        this.threadId =
          typeof resumeResult.thread?.id === 'string' ? resumeResult.thread.id : this.threadId
        this.activeTurnId = maybeActiveTurnId(resumeResult.thread)
        return
      } catch {
        this.stderrStream.write(
          `meet-ai: codex app-server could not resume thread ${this.threadId}, starting fresh\n`
        )
        this.threadId = null
        this.activeTurnId = null
      }
    }

    const startResult = await this.request<CodexThreadResponse>('thread/start', {
      cwd: this.cwd,
      experimentalRawEvents: false,
      persistExtendedHistory: this.experimentalApi,
    })
    this.threadId = typeof startResult.thread?.id === 'string' ? startResult.thread.id : null
    this.activeTurnId = maybeActiveTurnId(startResult.thread)
  }

  private async handleLine(line: string): Promise<void> {
    const trimmed = line.trim()
    if (!trimmed) return

    let message: unknown
    try {
      message = JSON.parse(trimmed)
    } catch {
      this.stderrStream.write(`meet-ai: failed to parse codex app-server line: ${trimmed}\n`)
      return
    }

    if (isJsonRpcResponse(message)) {
      const pending = this.pendingRequests.get(message.id)
      if (!pending) return
      this.pendingRequests.delete(message.id)

      if (message.error) {
        pending.reject(new Error(message.error.message ?? 'Unknown app-server error'))
        return
      }

      pending.resolve(message.result)
      return
    }

    if (isJsonRpcServerRequest(message)) {
      this.respondToServerRequest(message)
      return
    }

    if (isJsonRpcNotification(message)) {
      this.handleNotification(message)
    }
  }

  private handleNotification(message: JsonRpcNotification) {
    if (message.method === 'thread/started') {
      if (isThreadStartedNotification(message.params)) this.threadId = message.params.thread.id
      return
    }

    if (message.method === 'turn/started') {
      if (isTurnStartedNotification(message.params) && message.params.threadId === this.threadId) {
        this.activeTurnId = message.params.turn.id
      }
      return
    }

    if (message.method === 'turn/completed') {
      if (
        isTurnCompletedNotification(message.params) &&
        message.params.threadId === this.threadId &&
        message.params.turn.id === this.activeTurnId
      ) {
        this.activeTurnId = null
      }
      this.emitEvent({
        type: 'turn_completed',
        turnId: isTurnCompletedNotification(message.params) ? message.params.turn.id : null,
      })
      return
    }

    if (message.method === 'item/agentMessage/delta') {
      if (!matchesActiveThread(this.threadId, message.params)) return
      const event = extractAgentMessageDelta(message.params)
      if (event.text) {
        this.emitEvent({
          type: 'agent_message_delta',
          itemId: event.itemId,
          turnId: event.turnId,
          text: event.text,
        })
      }
      return
    }

    if (message.method === 'item/completed') {
      if (!matchesActiveThread(this.threadId, message.params)) return
      const event = extractCompletedAgentMessage(message.params)
      if (event?.text) {
        this.emitEvent({
          type: 'agent_message_completed',
          itemId: event.itemId,
          turnId: event.turnId,
          text: event.text,
        })
      }
    }
  }

  private emitEvent(event: CodexAppServerEvent): void {
    if (!this.eventHandler) return

    try {
      this.eventHandler(event)
    } catch (error) {
      this.stderrStream.write(
        `meet-ai: codex app-server event handler failed: ${toErrorMessage(error)}\n`
      )
    }
  }

  private respondToServerRequest(message: JsonRpcServerRequest) {
    switch (message.method) {
      case 'item/commandExecution/requestApproval': {
        this.stderrStream.write(
          `meet-ai: auto-resolving unsupported codex app-server request ${message.method}\n`
        )
        this.writeMessage({ id: message.id, result: { decision: 'decline' } })
        return
      }
      case 'item/fileChange/requestApproval': {
        this.stderrStream.write(
          `meet-ai: auto-resolving unsupported codex app-server request ${message.method}\n`
        )
        this.writeMessage({ id: message.id, result: { decision: 'decline' } })
        return
      }
      case 'item/tool/requestUserInput': {
        this.stderrStream.write(
          `meet-ai: auto-resolving unsupported codex app-server request ${message.method}\n`
        )
        this.writeMessage({ id: message.id, result: { answers: {} } })
        return
      }
      case 'mcpServer/elicitation/request': {
        this.stderrStream.write(
          `meet-ai: auto-resolving unsupported codex app-server request ${message.method}\n`
        )
        this.writeMessage({ id: message.id, result: { action: 'cancel', content: null } })
        return
      }
      case 'applyPatchApproval': {
        this.stderrStream.write(
          `meet-ai: auto-resolving unsupported codex app-server request ${message.method}\n`
        )
        this.writeMessage({ id: message.id, result: { decision: 'denied' } })
        return
      }
      case 'execCommandApproval': {
        this.stderrStream.write(
          `meet-ai: auto-resolving unsupported codex app-server request ${message.method}\n`
        )
        this.writeMessage({ id: message.id, result: { decision: 'denied' } })
        return
      }
      default: {
        this.stderrStream.write(
          `meet-ai: rejecting unsupported codex app-server request ${message.method}\n`
        )
        this.writeMessage({
          id: message.id,
          error: {
            message: `meet-ai app-server bridge does not support ${message.method}`,
          },
        })
      }
    }
  }

  private notify(method: string, params?: unknown) {
    this.writeMessage(params === undefined ? { method } : { method, params })
  }

  private request<T>(method: string, params?: unknown): Promise<T> {
    const id = this.nextRequestId++
    return new Promise<T>((resolve, reject) => {
      this.pendingRequests.set(id, { resolve: resolve as (value: unknown) => void, reject })
      try {
        this.writeMessage(params === undefined ? { method, id } : { method, id, params })
      } catch (error) {
        this.pendingRequests.delete(id)
        reject(error)
      }
    })
  }

  private writeMessage(message: Record<string, unknown>) {
    const child = this.child
    if (!child) {
      throw new Error('Codex app-server bridge is not connected')
    }

    child.stdin.write(`${JSON.stringify(message)}\n`)
  }
}

export function createCodexAppServerBridge(
  options: CodexAppServerBridgeOptions
): CodexAppServerBridge {
  return new CodexAppServerBridge(options)
}

export function describeCodexAppServerError(error: unknown): string {
  return `meet-ai: failed to inject message into Codex via app-server: ${toErrorMessage(error)}`
}
