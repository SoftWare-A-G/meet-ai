// Type-only shim so TypeScript can resolve cloudflare:workers
// when tracing worker types via hc<AppType>. Never used at runtime.
declare module 'cloudflare:workers' {
  export class DurableObject {
    ctx: DurableObjectState
    env: Record<string, unknown>
  }
}

// ---------------------------------------------------------------------------
// Cloudflare global types referenced by worker bindings & Durable Objects
// ---------------------------------------------------------------------------

// D1

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first<T = unknown>(column?: string): Promise<T | null>
  run(): Promise<D1Result>
  all<T = unknown>(): Promise<D1Result<T>>
}

interface D1Result<T = unknown> {
  results: T[]
  success: boolean
  meta: { changes: number; duration: number; last_row_id: number; [k: string]: unknown }
}

interface D1Database {
  prepare(query: string): D1PreparedStatement
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>
}

// Durable Objects

interface DurableObjectState {
  id: DurableObjectId
  storage: DurableObjectStorage
  getWebSockets(tag?: string): WebSocket[]
  acceptWebSocket(ws: WebSocket, tags?: string[]): void
  setWebSocketAutoResponse(pair: WebSocketRequestResponsePair): void
  getWebSocketAutoResponseTimestamp(ws: WebSocket): Date | null
}

interface DurableObjectId {
  toString(): string
}

interface DurableObjectStorage {
  get<T = unknown>(key: string): Promise<T | undefined>
  put(key: string, value: unknown): Promise<void>
  delete(key: string): Promise<boolean>
  getAlarm(): Promise<number | null>
  setAlarm(scheduledTime: number | Date): Promise<void>
}

interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId
  get(id: DurableObjectId): DurableObjectStub
}

interface DurableObjectStub {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>
}

// WebSocket helpers (constructable values, not just types)

declare class WebSocketPair {
  0: WebSocket
  1: WebSocket
}

declare class WebSocketRequestResponsePair {
  constructor(request: string, response: string)
  0: string
  1: string
}

// Workers runtime globals

interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>
}

interface KVNamespace {
  get(key: string, options?: unknown): Promise<string | null>
  put(key: string, value: string | ArrayBuffer | ReadableStream, options?: unknown): Promise<void>
  delete(key: string): Promise<void>
}

interface ScheduledEvent {
  scheduledTime: number
  cron: string
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void
  passThroughOnException(): void
}

// Extend ResponseInit to allow the webSocket property used by Workers
interface ResponseInit {
  webSocket?: WebSocket
}
