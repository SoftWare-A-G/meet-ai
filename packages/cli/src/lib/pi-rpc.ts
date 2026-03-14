import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import type { AgentSessionEvent } from '@mariozechner/pi-coding-agent'

export type { AgentSessionEvent as PiAgentEvent }

/**
 * Extension UI request from Pi RPC (stdout).
 * Dialog methods (select, confirm, input, editor) expect a response.
 * Fire-and-forget methods (notify, setStatus, setWidget, setTitle, set_editor_text) do not.
 */
export type PiExtensionUIRequest =
  | { type: 'extension_ui_request'; id: string; method: 'select'; title: string; options: string[]; timeout?: number }
  | { type: 'extension_ui_request'; id: string; method: 'confirm'; title: string; message: string; timeout?: number }
  | { type: 'extension_ui_request'; id: string; method: 'input'; title: string; placeholder?: string; timeout?: number }
  | { type: 'extension_ui_request'; id: string; method: 'editor'; title: string; prefill?: string }
  | { type: 'extension_ui_request'; id: string; method: 'notify'; message: string; notifyType?: 'info' | 'warning' | 'error' }
  | { type: 'extension_ui_request'; id: string; method: 'setStatus'; statusKey: string; statusText: string | undefined }
  | { type: 'extension_ui_request'; id: string; method: 'setWidget'; widgetKey: string; widgetLines: string[] | undefined; widgetPlacement?: 'aboveEditor' | 'belowEditor' }
  | { type: 'extension_ui_request'; id: string; method: 'setTitle'; title: string }
  | { type: 'extension_ui_request'; id: string; method: 'set_editor_text'; text: string }

export interface PiBridge {
  start(): Promise<void>
  sendPrompt(text: string): Promise<void>
  /**
   * Queue a message that will be delivered when the agent finishes its current
   * run. Safe to call at any time — messages are serialized internally.
   */
  followUp(text: string): Promise<void>
  /**
   * Inject a room message. Automatically chooses the right delivery method:
   * - `prompt()` when Pi is idle
   * - `follow_up()` when Pi is streaming (queued, non-interrupting)
   *
   * All calls are serialized through an internal queue so concurrent room
   * messages never race.
   */
  inject(text: string, images?: { type: 'image'; data: string; mimeType: string }[]): Promise<void>
  steer(text: string): Promise<void>
  abort(): Promise<void>
  close(): Promise<void>
  setEventHandler(handler: ((event: AgentSessionEvent) => void) | null): void
  setUiRequestHandler(handler: ((request: PiExtensionUIRequest) => void) | null): void
  /** Send a response to a dialog extension_ui_request (select, confirm, input, editor) */
  sendUiResponse(response: Record<string, unknown>): void
  getCurrentModel(): string | null
  readonly isStreaming: boolean
}

type PendingRequest = {
  resolve: (value: unknown) => void
  reject: (reason?: unknown) => void
}

export interface PiBridgeOptions {
  /** Paths to Pi extension files to load via --extension */
  extensions?: string[]
}

/**
 * Spawns `pi --mode rpc --no-session` and communicates via JSONL stdin/stdout.
 * Maps Pi RPC events to the SDK's `AgentSessionEvent` type.
 *
 * Key design decisions (matching Codex bridge patterns):
 *
 * 1. **Streaming-aware injection** — `inject()` checks `isStreaming` to decide
 *    between `prompt` (idle) and `follow_up` (streaming). This prevents
 *    interrupting Pi mid-task, unlike `steer` which kills remaining tool calls.
 *
 * 2. **Serialized injection queue** — all `inject()` calls go through a promise
 *    chain so concurrent room messages never race against each other or against
 *    Pi's state transitions.
 *
 * 3. **Streaming state tracking** — `isStreaming` is set on `agent_start` and
 *    cleared on `agent_end`, giving the injection logic a reliable signal.
 */
export function createPiBridge(binaryPath: string, workDir: string, options?: PiBridgeOptions): PiBridge {
  let proc: ChildProcessWithoutNullStreams | null = null
  let eventHandler: ((event: AgentSessionEvent) => void) | null = null
  let uiRequestHandler: ((request: PiExtensionUIRequest) => void) | null = null
  let currentModel: string | null = null
  let streaming = false
  let injectionQueue: Promise<void> = Promise.resolve()
  const pendingRequests = new Map<string, PendingRequest>()

  function send(obj: Record<string, unknown>) {
    if (!proc?.stdin.writable) return
    proc.stdin.write(`${JSON.stringify(obj)}\n`)
  }

  function sendCommand(
    type: string,
    extra: Record<string, unknown> = {},
  ): Promise<unknown> {
    const id = randomUUID()
    return new Promise((resolve, reject) => {
      pendingRequests.set(id, { resolve, reject })
      send({ id, type, ...extra })
    })
  }

  function enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const next = injectionQueue.then(fn, fn)
    injectionQueue = next.catch(() => undefined) as Promise<void>
    return next
  }

  function handleLine(line: string) {
    if (!line.trim()) return
    let msg: Record<string, unknown>
    try {
      msg = JSON.parse(line)
    } catch {
      return
    }

    // Handle responses to our commands
    if (msg.type === 'response') {
      const id = msg.id as string | undefined
      if (id && pendingRequests.has(id)) {
        const pending = pendingRequests.get(id)!
        pendingRequests.delete(id)
        if (msg.success) {
          pending.resolve(msg.data ?? null)
        } else {
          pending.reject(new Error((msg.error as string) ?? 'Unknown Pi RPC error'))
        }
      }
      return
    }

    // Route extension UI requests to their own handler
    if (msg.type === 'extension_ui_request') {
      uiRequestHandler?.(msg as unknown as PiExtensionUIRequest)
      return
    }

    // Track streaming state from agent lifecycle events
    if (msg.type === 'agent_start') {
      streaming = true
    } else if (msg.type === 'agent_end') {
      streaming = false
    }

    // Forward the raw event to the handler — it's already an AgentSessionEvent
    // since Pi RPC outputs these as JSON lines on stdout.
    eventHandler?.(msg as AgentSessionEvent)
  }

  return {
    get isStreaming() {
      return streaming
    },

    async start() {
      const args = ['--mode', 'rpc', '--no-session']
      for (const ext of options?.extensions ?? []) {
        args.push('--extension', ext)
      }
      proc = spawn(binaryPath, args, {
        cwd: workDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env },
      })

      // JSONL reader using LF-only splitting (as per Pi RPC spec)
      let buffer = ''
      proc.stdout.on('data', (chunk: Buffer) => {
        buffer += chunk.toString('utf-8')
        let idx: number
        while ((idx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, idx)
          buffer = buffer.slice(idx + 1)
          if (line.endsWith('\r')) line = line.slice(0, -1)
          handleLine(line)
        }
      })

      proc.stderr.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf-8').trim()
        if (text) {
          // stderr isn't an AgentSessionEvent — we can't forward it as one.
          // Log it to the console so it's visible in tmux panes.
          console.error(`[pi-rpc] ${text}`)
        }
      })

      proc.on('exit', () => {
        streaming = false
        // Reject all pending requests
        for (const [, pending] of pendingRequests) {
          pending.reject(new Error('Pi process exited'))
        }
        pendingRequests.clear()
        proc = null
      })

      // Query initial state to get the current model
      try {
        const state = (await sendCommand('get_state')) as {
          model?: { name?: string; id?: string } | null
        }
        if (state?.model) {
          currentModel = state.model.name ?? state.model.id ?? null
        }
      } catch {
        // ignore - model info is optional
      }
    },

    async sendPrompt(text: string) {
      await sendCommand('prompt', { message: text })
    },

    async steer(text: string) {
      await sendCommand('steer', { message: text })
    },

    async followUp(text: string) {
      await sendCommand('follow_up', { message: text })
    },

    inject(text: string, images?: { type: 'image'; data: string; mimeType: string }[]): Promise<void> {
      return enqueue(async () => {
        const extra: Record<string, unknown> = { message: text }
        if (images?.length) {
          extra.images = images
        }
        if (streaming) {
          // Pi is busy — queue as follow_up so it's delivered after the
          // current run finishes, without interrupting tool execution.
          await sendCommand('follow_up', extra)
        } else {
          // Pi is idle — send as a normal prompt.
          await sendCommand('prompt', extra)
        }
      })
    },

    async abort() {
      await sendCommand('abort')
    },

    async close() {
      streaming = false
      if (!proc) return
      try {
        send({ type: 'abort' })
      } catch {
        // ignore
      }
      proc.kill('SIGTERM')
      proc = null
      for (const [, pending] of pendingRequests) {
        pending.reject(new Error('Pi bridge closed'))
      }
      pendingRequests.clear()
    },

    setEventHandler(handler) {
      eventHandler = handler
    },

    setUiRequestHandler(handler) {
      uiRequestHandler = handler
    },

    sendUiResponse(response: Record<string, unknown>) {
      send({ type: 'extension_ui_response', ...response })
    },

    getCurrentModel() {
      return currentModel
    },
  }
}
