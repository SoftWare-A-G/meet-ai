import {
  spawn,
  type ChildProcessWithoutNullStreams,
  type SpawnOptionsWithoutStdio,
} from 'node:child_process'
import { createInterface, type Interface as ReadLineInterface } from 'node:readline'
import type { AgentMessageDeltaNotification } from '@meet-ai/cli/generated/codex-app-server/v2/AgentMessageDeltaNotification'
import type { CommandExecutionOutputDeltaNotification } from '@meet-ai/cli/generated/codex-app-server/v2/CommandExecutionOutputDeltaNotification'
import type { DynamicToolCallParams } from '@meet-ai/cli/generated/codex-app-server/v2/DynamicToolCallParams'
import type { DynamicToolCallResponse } from '@meet-ai/cli/generated/codex-app-server/v2/DynamicToolCallResponse'
import type { DynamicToolSpec } from '@meet-ai/cli/generated/codex-app-server/v2/DynamicToolSpec'
import type { ErrorNotification } from '@meet-ai/cli/generated/codex-app-server/v2/ErrorNotification'
import type { FileChangeOutputDeltaNotification } from '@meet-ai/cli/generated/codex-app-server/v2/FileChangeOutputDeltaNotification'
import type { ItemCompletedNotification } from '@meet-ai/cli/generated/codex-app-server/v2/ItemCompletedNotification'
import type { ItemStartedNotification } from '@meet-ai/cli/generated/codex-app-server/v2/ItemStartedNotification'
import type { ModelReroutedNotification } from '@meet-ai/cli/generated/codex-app-server/v2/ModelReroutedNotification'
import type { PlanDeltaNotification } from '@meet-ai/cli/generated/codex-app-server/v2/PlanDeltaNotification'
import type { ReasoningSummaryTextDeltaNotification } from '@meet-ai/cli/generated/codex-app-server/v2/ReasoningSummaryTextDeltaNotification'
import type { ReasoningTextDeltaNotification } from '@meet-ai/cli/generated/codex-app-server/v2/ReasoningTextDeltaNotification'
import type { TerminalInteractionNotification } from '@meet-ai/cli/generated/codex-app-server/v2/TerminalInteractionNotification'
import type { Thread } from '@meet-ai/cli/generated/codex-app-server/v2/Thread'
import type { ThreadNameUpdatedNotification } from '@meet-ai/cli/generated/codex-app-server/v2/ThreadNameUpdatedNotification'
import type { ThreadStartedNotification } from '@meet-ai/cli/generated/codex-app-server/v2/ThreadStartedNotification'
import type { ThreadStatusChangedNotification } from '@meet-ai/cli/generated/codex-app-server/v2/ThreadStatusChangedNotification'
import type { ThreadTokenUsageUpdatedNotification } from '@meet-ai/cli/generated/codex-app-server/v2/ThreadTokenUsageUpdatedNotification'
import type { Turn } from '@meet-ai/cli/generated/codex-app-server/v2/Turn'
import type { TurnCompletedNotification } from '@meet-ai/cli/generated/codex-app-server/v2/TurnCompletedNotification'
import type { TurnPlanUpdatedNotification } from '@meet-ai/cli/generated/codex-app-server/v2/TurnPlanUpdatedNotification'
import type { TurnStartedNotification } from '@meet-ai/cli/generated/codex-app-server/v2/TurnStartedNotification'
import { emitCodexAppServerLog } from './codex-app-server-evlog'

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

export type DynamicToolCallHandler = (
  tool: string,
  args: unknown
) => Promise<DynamicToolCallResponse>

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
  dynamicTools?: DynamicToolSpec[]
  toolCallHandler?: DynamicToolCallHandler
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
  start(): Promise<void>
  injectText(input: CodexAppServerTextInput): Promise<CodexInjectionResult>
  injectPrompt(text: string): Promise<CodexInjectionResult>
  close(): Promise<void>
  setEventHandler(handler: ((event: CodexAppServerEvent) => void) | null): void
  getCurrentModel(): string | null
}

type CodexThreadResponse = {
  thread?: Thread
  model?: string | null
  reasoningEffort?: string | null
}

function formatModelLabel(model: string | null | undefined, reasoningEffort: string | null | undefined): string | null {
  const normalizedModel = typeof model === 'string' ? model.trim() : ''
  if (!normalizedModel) return null

  const normalizedEffort = typeof reasoningEffort === 'string' ? reasoningEffort.trim() : ''
  if (!normalizedEffort) return normalizedModel

  return `${normalizedModel} (${normalizedEffort})`
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

function previewText(value: string | null | undefined, limit = 120): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (!normalized) return null
  if (normalized.length <= limit) return normalized
  return `${normalized.slice(0, limit)}...`
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

function isItemStartedNotification(params: unknown): params is ItemStartedNotification {
  return (
    isObject(params) &&
    typeof params.threadId === 'string' &&
    typeof params.turnId === 'string' &&
    isObject(params.item) &&
    typeof params.item.type === 'string' &&
    typeof params.item.id === 'string'
  )
}

function isThreadStatusChangedNotification(params: unknown): params is ThreadStatusChangedNotification {
  return (
    isObject(params) &&
    typeof params.threadId === 'string' &&
    typeof params.status === 'string'
  )
}

function isThreadNameUpdatedNotification(params: unknown): params is ThreadNameUpdatedNotification {
  return isObject(params) && typeof params.threadId === 'string'
}

function isThreadTokenUsageUpdatedNotification(params: unknown): params is ThreadTokenUsageUpdatedNotification {
  return (
    isObject(params) &&
    typeof params.threadId === 'string' &&
    typeof params.turnId === 'string' &&
    isObject(params.tokenUsage)
  )
}

function isTurnPlanUpdatedNotification(params: unknown): params is TurnPlanUpdatedNotification {
  return (
    isObject(params) &&
    typeof params.threadId === 'string' &&
    typeof params.turnId === 'string' &&
    Array.isArray(params.plan)
  )
}

function isReasoningSummaryTextDeltaNotification(params: unknown): params is ReasoningSummaryTextDeltaNotification {
  return (
    isObject(params) &&
    typeof params.threadId === 'string' &&
    typeof params.turnId === 'string' &&
    typeof params.itemId === 'string' &&
    typeof params.delta === 'string'
  )
}

function isReasoningTextDeltaNotification(params: unknown): params is ReasoningTextDeltaNotification {
  return (
    isObject(params) &&
    typeof params.threadId === 'string' &&
    typeof params.turnId === 'string' &&
    typeof params.itemId === 'string' &&
    typeof params.delta === 'string'
  )
}

function isPlanDeltaNotification(params: unknown): params is PlanDeltaNotification {
  return (
    isObject(params) &&
    typeof params.threadId === 'string' &&
    typeof params.turnId === 'string' &&
    typeof params.itemId === 'string' &&
    typeof params.delta === 'string'
  )
}

function isCommandExecutionOutputDeltaNotification(params: unknown): params is CommandExecutionOutputDeltaNotification {
  return (
    isObject(params) &&
    typeof params.threadId === 'string' &&
    typeof params.turnId === 'string' &&
    typeof params.itemId === 'string' &&
    typeof params.delta === 'string'
  )
}

function isFileChangeOutputDeltaNotification(params: unknown): params is FileChangeOutputDeltaNotification {
  return (
    isObject(params) &&
    typeof params.threadId === 'string' &&
    typeof params.turnId === 'string' &&
    typeof params.itemId === 'string' &&
    typeof params.delta === 'string'
  )
}

function isModelReroutedNotification(params: unknown): params is ModelReroutedNotification {
  return (
    isObject(params) &&
    typeof params.threadId === 'string' &&
    typeof params.turnId === 'string' &&
    typeof params.fromModel === 'string' &&
    typeof params.toModel === 'string' &&
    typeof params.reason === 'string'
  )
}

function isTerminalInteractionNotification(params: unknown): params is TerminalInteractionNotification {
  return (
    isObject(params) &&
    typeof params.threadId === 'string' &&
    typeof params.turnId === 'string' &&
    typeof params.itemId === 'string' &&
    typeof params.processId === 'string' &&
    typeof params.stdin === 'string'
  )
}

function isErrorNotification(params: unknown): params is ErrorNotification {
  return (
    isObject(params) &&
    typeof params.threadId === 'string' &&
    typeof params.turnId === 'string' &&
    typeof params.willRetry === 'boolean' &&
    isObject(params.error)
  )
}

function summarizeThreadItem(item: ItemCompletedNotification['item']): Record<string, unknown> {
  switch (item.type) {
    case 'agentMessage': {
      return {
        itemType: item.type,
        itemId: item.id,
        phase: item.phase,
        textLength: item.text.length,
        preview: previewText(item.text),
      }
    }
    case 'commandExecution': {
      return {
        itemType: item.type,
        itemId: item.id,
        status: item.status,
        command: item.command,
        cwd: item.cwd,
        exitCode: item.exitCode,
        durationMs: item.durationMs,
        outputLength: item.aggregatedOutput?.length ?? 0,
        preview: previewText(item.aggregatedOutput),
      }
    }
    case 'fileChange': {
      return {
        itemType: item.type,
        itemId: item.id,
        status: item.status,
        changeCount: item.changes.length,
      }
    }
    case 'dynamicToolCall': {
      return {
        itemType: item.type,
        itemId: item.id,
        tool: item.tool,
        status: item.status,
        success: item.success,
        durationMs: item.durationMs,
        contentItemCount: item.contentItems?.length ?? 0,
      }
    }
    case 'mcpToolCall': {
      return {
        itemType: item.type,
        itemId: item.id,
        server: item.server,
        tool: item.tool,
        status: item.status,
        durationMs: item.durationMs,
        hasResult: item.result != null,
        hasError: item.error != null,
      }
    }
    case 'collabAgentToolCall': {
      return {
        itemType: item.type,
        itemId: item.id,
        tool: item.tool,
        status: item.status,
        receiverCount: item.receiverThreadIds.length,
        preview: previewText(item.prompt),
      }
    }
    case 'plan': {
      return {
        itemType: item.type,
        itemId: item.id,
        textLength: item.text.length,
        preview: previewText(item.text),
      }
    }
    case 'reasoning': {
      return {
        itemType: item.type,
        itemId: item.id,
        summaryCount: item.summary.length,
        contentCount: item.content.length,
        preview: previewText(item.summary.join(' ')) ?? previewText(item.content.join(' ')),
      }
    }
    case 'webSearch': {
      return {
        itemType: item.type,
        itemId: item.id,
        query: item.query,
        action: item.action,
      }
    }
    case 'imageView': {
      return {
        itemType: item.type,
        itemId: item.id,
        path: item.path,
      }
    }
    case 'imageGeneration': {
      return {
        itemType: item.type,
        itemId: item.id,
        status: item.status,
        resultLength: item.result.length,
        preview: previewText(item.revisedPrompt ?? item.result),
      }
    }
    case 'enteredReviewMode':
    case 'exitedReviewMode': {
      return {
        itemType: item.type,
        itemId: item.id,
        review: item.review,
      }
    }
    case 'userMessage': {
      return {
        itemType: item.type,
        itemId: item.id,
        contentItemCount: item.content.length,
      }
    }
    case 'contextCompaction': {
      return {
        itemType: item.type,
        itemId: item.id,
      }
    }
  }
}

function summarizeNotificationParams(method: string, params: unknown): Record<string, unknown> {
  if (!isObject(params)) return {}

  const summary: Record<string, unknown> = {}

  if (typeof params.threadId === 'string') summary.threadId = params.threadId
  if (typeof params.turnId === 'string') summary.turnId = params.turnId
  if (typeof params.itemId === 'string') summary.itemId = params.itemId
  if (typeof params.requestId === 'string' || typeof params.requestId === 'number') summary.requestId = params.requestId

  if ((method === 'item/started' || method === 'item/completed') && isObject(params.item)) {
    Object.assign(summary, summarizeThreadItem(params.item as ItemCompletedNotification['item']))
    return summary
  }

  if ('delta' in params && typeof params.delta === 'string') {
    summary.deltaLength = params.delta.length
    summary.preview = previewText(params.delta)
  }

  if (method === 'turn/planUpdated' && Array.isArray(params.plan)) {
    summary.planStepCount = params.plan.length
    if (typeof params.explanation === 'string') summary.preview = previewText(params.explanation)
  }

  if (method === 'thread/tokenUsageUpdated' && isObject(params.tokenUsage)) {
    summary.tokenUsage = params.tokenUsage
  }

  if (method === 'model/rerouted') {
    if (typeof params.fromModel === 'string') summary.fromModel = params.fromModel
    if (typeof params.toModel === 'string') summary.toModel = params.toModel
    if (typeof params.reason === 'string') summary.reason = params.reason
  }

  if (method === 'terminal/interaction') {
    if (typeof params.processId === 'string') summary.processId = params.processId
    if (typeof params.stdin === 'string') {
      summary.stdinLength = params.stdin.length
      summary.preview = previewText(params.stdin)
    }
  }

  if (method === 'error' && isObject(params.error)) {
    summary.error = params.error
    if (typeof params.willRetry === 'boolean') summary.willRetry = params.willRetry
  }

  if (Object.keys(summary).length === 0) {
    summary.keys = Object.keys(params).sort()
  }

  return summary
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
  private readonly dynamicTools: DynamicToolSpec[]
  private readonly toolCallHandler: DynamicToolCallHandler | null

  private child: ChildProcessWithoutNullStreams | null = null
  private stdoutReader: ReadLineInterface | null = null
  private readyPromise: Promise<void> | null = null
  private pendingRequests = new Map<string | number, PendingRequest>()
  private nextRequestId = 1
  private activeTurnId: string | null = null
  private currentModel: string | null = null
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
    this.dynamicTools = options.dynamicTools ?? []
    this.toolCallHandler = options.toolCallHandler ?? null
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

  getCurrentModel(): string | null {
    return this.currentModel
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
    emitCodexAppServerLog('info', 'codex-app-server', 'process.spawn', {
      cwd: this.cwd ?? process.cwd(),
      codexBin: this.codexBin,
      experimentalApi: this.experimentalApi,
      dynamicToolCount: this.dynamicTools.length,
    })

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

    let stderrBuffer = ''
    child.stderr.on('data', chunk => {
      stderrBuffer += chunk.toString()
      let newlineIndex = stderrBuffer.indexOf('\n')
      while (newlineIndex >= 0) {
        const line = stderrBuffer.slice(0, newlineIndex).trim()
        stderrBuffer = stderrBuffer.slice(newlineIndex + 1)
        newlineIndex = stderrBuffer.indexOf('\n')
        if (!line) continue
        emitCodexAppServerLog('warn', 'codex-app-server', 'process.stderr', {
          stderr: line,
        })
      }
    })

    child.on('exit', (_code, signal) => {
      const details = {
        signal: signal ?? null,
        threadId: this.threadId,
        activeTurnId: this.activeTurnId,
      }
      if (stderrBuffer.trim()) {
        emitCodexAppServerLog('warn', 'codex-app-server', 'process.stderr', {
          stderr: stderrBuffer.trim(),
          trailing: true,
        })
      }
      emitCodexAppServerLog('warn', 'codex-app-server', 'process.exit', details)

      const reason = new Error(`codex app-server exited${signal ? ` with signal ${signal}` : ''}`)
      for (const pending of this.pendingRequests.values()) {
        pending.reject(reason)
      }
      this.pendingRequests.clear()
      this.child = null
      this.stdoutReader = null
      this.readyPromise = null
    })

    emitCodexAppServerLog('debug', 'codex-app-server', 'rpc.initialize')
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
        emitCodexAppServerLog('info', 'codex-app-server', 'thread.resume.requested', {
          threadId: this.threadId,
        })
        const resumeResult = await this.request<CodexThreadResponse>('thread/resume', resumeParams)
        this.threadId =
          typeof resumeResult.thread?.id === 'string' ? resumeResult.thread.id : this.threadId
        this.activeTurnId = maybeActiveTurnId(resumeResult.thread)
        this.currentModel =
          formatModelLabel(resumeResult.model, resumeResult.reasoningEffort) ?? this.currentModel
        emitCodexAppServerLog('info', 'codex-app-server', 'thread.resume.succeeded', {
          threadId: this.threadId,
          activeTurnId: this.activeTurnId,
          model: this.currentModel,
        })
        return
      } catch {
        emitCodexAppServerLog('warn', 'codex-app-server', 'thread.resume.failed', {
          threadId: this.threadId,
        })
        this.threadId = null
        this.activeTurnId = null
      }
    }

    emitCodexAppServerLog('info', 'codex-app-server', 'thread.start.requested', {
      cwd: this.cwd ?? process.cwd(),
    })
    const startResult = await this.request<CodexThreadResponse>('thread/start', {
      cwd: this.cwd,
      experimentalRawEvents: false,
      persistExtendedHistory: this.experimentalApi,
      ...(this.dynamicTools.length > 0 ? { dynamicTools: this.dynamicTools } : {}),
    })
    this.threadId = typeof startResult.thread?.id === 'string' ? startResult.thread.id : null
    this.activeTurnId = maybeActiveTurnId(startResult.thread)
    this.currentModel =
      formatModelLabel(startResult.model, startResult.reasoningEffort) ?? this.currentModel
    emitCodexAppServerLog('info', 'codex-app-server', 'thread.start.succeeded', {
      threadId: this.threadId,
      activeTurnId: this.activeTurnId,
      model: this.currentModel,
    })
  }

  private async handleLine(line: string): Promise<void> {
    const trimmed = line.trim()
    if (!trimmed) return

    let message: unknown
    try {
      message = JSON.parse(trimmed)
    } catch {
      emitCodexAppServerLog('error', 'codex-app-server', 'rpc.parse_failed', {
        line: trimmed,
      })
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
    emitCodexAppServerLog('debug', 'codex-app-server', 'notification.received', {
      method: message.method,
      ...summarizeNotificationParams(message.method, message.params),
    })

    if (message.method === 'thread/started') {
      if (isThreadStartedNotification(message.params)) {
        this.threadId = message.params.thread.id
        emitCodexAppServerLog('info', 'codex-app-server', 'thread.started', {
          threadId: message.params.thread.id,
          turnCount: message.params.thread.turns?.length ?? 0,
        })
      }
      return
    }

    if (message.method === 'thread/statusChanged') {
      if (isThreadStatusChangedNotification(message.params)) {
        emitCodexAppServerLog('info', 'codex-app-server', 'thread.status_changed', {
          threadId: message.params.threadId,
          status: message.params.status,
        })
      }
      return
    }

    if (message.method === 'thread/nameUpdated') {
      if (isThreadNameUpdatedNotification(message.params)) {
        emitCodexAppServerLog('info', 'codex-app-server', 'thread.name_updated', {
          threadId: message.params.threadId,
          threadName: message.params.threadName ?? null,
        })
      }
      return
    }

    if (message.method === 'thread/tokenUsageUpdated') {
      if (isThreadTokenUsageUpdatedNotification(message.params)) {
        emitCodexAppServerLog('info', 'codex-app-server', 'thread.token_usage_updated', {
          threadId: message.params.threadId,
          turnId: message.params.turnId,
          tokenUsage: message.params.tokenUsage,
        })
      }
      return
    }

    if (message.method === 'turn/started') {
      if (isTurnStartedNotification(message.params) && message.params.threadId === this.threadId) {
        this.activeTurnId = message.params.turn.id
      }
      if (isTurnStartedNotification(message.params)) {
        emitCodexAppServerLog('info', 'codex-app-server', 'turn.started', {
          threadId: message.params.threadId,
          turnId: message.params.turn.id,
          status: message.params.turn.status,
        })
      }
      return
    }

    if (message.method === 'turn/planUpdated') {
      if (isTurnPlanUpdatedNotification(message.params)) {
        emitCodexAppServerLog('info', 'codex-app-server', 'turn.plan_updated', {
          threadId: message.params.threadId,
          turnId: message.params.turnId,
          explanation: message.params.explanation,
          planStepCount: message.params.plan.length,
        })
      }
      return
    }

    if (message.method === 'turn/completed') {
      const clearedActiveTurn =
        isTurnCompletedNotification(message.params) &&
        message.params.threadId === this.threadId &&
        message.params.turn.id === this.activeTurnId
      if (
        clearedActiveTurn
      ) {
        this.activeTurnId = null
      }
      if (isTurnCompletedNotification(message.params)) {
        emitCodexAppServerLog('info', 'codex-app-server', 'turn.completed', {
          threadId: message.params.threadId,
          turnId: message.params.turn.id,
          activeTurnCleared: clearedActiveTurn,
        })
      }
      this.emitEvent({
        type: 'turn_completed',
        turnId: isTurnCompletedNotification(message.params) ? message.params.turn.id : null,
      })
      return
    }

    if (message.method === 'item/started') {
      if (isItemStartedNotification(message.params)) {
        emitCodexAppServerLog('info', 'codex-app-server', 'item.started', {
          threadId: message.params.threadId,
          turnId: message.params.turnId,
          ...summarizeThreadItem(message.params.item),
        })
      }
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

    if (message.method === 'item/reasoningSummaryText/delta') {
      if (isReasoningSummaryTextDeltaNotification(message.params)) {
        emitCodexAppServerLog('debug', 'codex-app-server', 'item.reasoning_summary_delta', {
          threadId: message.params.threadId,
          turnId: message.params.turnId,
          itemId: message.params.itemId,
          summaryIndex: message.params.summaryIndex,
          deltaLength: message.params.delta.length,
          preview: previewText(message.params.delta),
        })
      }
      return
    }

    if (message.method === 'item/reasoningText/delta') {
      if (isReasoningTextDeltaNotification(message.params)) {
        emitCodexAppServerLog('debug', 'codex-app-server', 'item.reasoning_delta', {
          threadId: message.params.threadId,
          turnId: message.params.turnId,
          itemId: message.params.itemId,
          contentIndex: message.params.contentIndex,
          deltaLength: message.params.delta.length,
          preview: previewText(message.params.delta),
        })
      }
      return
    }

    if (message.method === 'item/plan/delta') {
      if (isPlanDeltaNotification(message.params)) {
        emitCodexAppServerLog('debug', 'codex-app-server', 'item.plan_delta', {
          threadId: message.params.threadId,
          turnId: message.params.turnId,
          itemId: message.params.itemId,
          deltaLength: message.params.delta.length,
          preview: previewText(message.params.delta),
        })
      }
      return
    }

    if (message.method === 'item/commandExecution/outputDelta') {
      if (isCommandExecutionOutputDeltaNotification(message.params)) {
        emitCodexAppServerLog('debug', 'codex-app-server', 'item.command_execution_output_delta', {
          threadId: message.params.threadId,
          turnId: message.params.turnId,
          itemId: message.params.itemId,
          deltaLength: message.params.delta.length,
          preview: previewText(message.params.delta),
        })
      }
      return
    }

    if (message.method === 'item/fileChange/outputDelta') {
      if (isFileChangeOutputDeltaNotification(message.params)) {
        emitCodexAppServerLog('debug', 'codex-app-server', 'item.file_change_output_delta', {
          threadId: message.params.threadId,
          turnId: message.params.turnId,
          itemId: message.params.itemId,
          deltaLength: message.params.delta.length,
          preview: previewText(message.params.delta),
        })
      }
      return
    }

    if (message.method === 'item/completed') {
      if (isItemCompletedNotification(message.params)) {
        emitCodexAppServerLog('info', 'codex-app-server', 'item.completed', {
          threadId: message.params.threadId,
          turnId: message.params.turnId,
          ...summarizeThreadItem(message.params.item),
        })
      }
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
      return
    }

    if (message.method === 'model/rerouted') {
      if (isModelReroutedNotification(message.params)) {
        emitCodexAppServerLog('warn', 'codex-app-server', 'model.rerouted', {
          threadId: message.params.threadId,
          turnId: message.params.turnId,
          fromModel: message.params.fromModel,
          toModel: message.params.toModel,
          reason: message.params.reason,
        })
      }
      return
    }

    if (message.method === 'terminal/interaction') {
      if (isTerminalInteractionNotification(message.params)) {
        emitCodexAppServerLog('info', 'codex-app-server', 'terminal.interaction', {
          threadId: message.params.threadId,
          turnId: message.params.turnId,
          itemId: message.params.itemId,
          processId: message.params.processId,
          stdinLength: message.params.stdin.length,
          preview: previewText(message.params.stdin),
        })
      }
      return
    }

    if (message.method === 'error') {
      if (isErrorNotification(message.params)) {
        emitCodexAppServerLog('error', 'codex-app-server', 'turn.error', {
          threadId: message.params.threadId,
          turnId: message.params.turnId,
          willRetry: message.params.willRetry,
          error: message.params.error,
        })
      }
    }
  }

  private emitEvent(event: CodexAppServerEvent): void {
    if (!this.eventHandler) return

    try {
      this.eventHandler(event)
    } catch (error) {
      emitCodexAppServerLog('error', 'codex-app-server', 'event_handler.failed', {
        error: toErrorMessage(error),
        eventType: event.type,
      })
    }
  }

  private respondToServerRequest(message: JsonRpcServerRequest) {
    switch (message.method) {
      case 'item/commandExecution/requestApproval': {
        emitCodexAppServerLog('warn', 'codex-app-server', 'server_request.auto_resolved', {
          method: message.method,
          decision: 'decline',
        })
        this.writeMessage({ id: message.id, result: { decision: 'decline' } })
        return
      }
      case 'item/fileChange/requestApproval': {
        emitCodexAppServerLog('warn', 'codex-app-server', 'server_request.auto_resolved', {
          method: message.method,
          decision: 'decline',
        })
        this.writeMessage({ id: message.id, result: { decision: 'decline' } })
        return
      }
      case 'item/tool/requestUserInput': {
        emitCodexAppServerLog('warn', 'codex-app-server', 'server_request.auto_resolved', {
          method: message.method,
          decision: 'empty_answers',
        })
        this.writeMessage({ id: message.id, result: { answers: {} } })
        return
      }
      case 'mcpServer/elicitation/request': {
        emitCodexAppServerLog('warn', 'codex-app-server', 'server_request.auto_resolved', {
          method: message.method,
          decision: 'cancel',
        })
        this.writeMessage({ id: message.id, result: { action: 'cancel', content: null } })
        return
      }
      case 'applyPatchApproval': {
        emitCodexAppServerLog('warn', 'codex-app-server', 'server_request.auto_resolved', {
          method: message.method,
          decision: 'denied',
        })
        this.writeMessage({ id: message.id, result: { decision: 'denied' } })
        return
      }
      case 'execCommandApproval': {
        emitCodexAppServerLog('warn', 'codex-app-server', 'server_request.auto_resolved', {
          method: message.method,
          decision: 'denied',
        })
        this.writeMessage({ id: message.id, result: { decision: 'denied' } })
        return
      }
      case 'item/tool/call': {
        void this.handleToolCall(message)
        return
      }
      default: {
        emitCodexAppServerLog('error', 'codex-app-server', 'server_request.rejected', {
          method: message.method,
        })
        this.writeMessage({
          id: message.id,
          error: {
            message: `meet-ai app-server bridge does not support ${message.method}`,
          },
        })
      }
    }
  }

  private async handleToolCall(message: JsonRpcServerRequest): Promise<void> {
    const params = message.params as DynamicToolCallParams | undefined

    if (!params || typeof params.tool !== 'string') {
      this.writeMessage({
        id: message.id,
        result: {
          contentItems: [{ type: 'inputText', text: JSON.stringify({ error: 'Invalid tool call: missing tool name' }) }],
          success: false,
        } satisfies DynamicToolCallResponse,
      })
      return
    }

    if (!this.toolCallHandler) {
      emitCodexAppServerLog('error', 'codex-app-server', 'tool_call.rejected', {
        tool: params.tool,
        reason: 'no_handler_registered',
      })
      this.writeMessage({
        id: message.id,
        result: {
          contentItems: [{ type: 'inputText', text: JSON.stringify({ error: 'No handler registered for dynamic tool calls' }) }],
          success: false,
        } satisfies DynamicToolCallResponse,
      })
      return
    }

    try {
      emitCodexAppServerLog('info', 'codex-app-server', 'tool_call.started', {
        tool: params.tool,
      })
      const response = await this.toolCallHandler(params.tool, params.arguments)
      emitCodexAppServerLog('info', 'codex-app-server', 'tool_call.completed', {
        tool: params.tool,
        success: response.success,
      })
      this.writeMessage({ id: message.id, result: response })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      emitCodexAppServerLog('error', 'codex-app-server', 'tool_call.failed', {
        tool: params.tool,
        error: errorMessage,
      })
      this.writeMessage({
        id: message.id,
        result: {
          contentItems: [{ type: 'inputText', text: JSON.stringify({ error: errorMessage }) }],
          success: false,
        } satisfies DynamicToolCallResponse,
      })
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
  return toErrorMessage(error)
}
