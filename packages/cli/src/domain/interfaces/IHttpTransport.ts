export interface RetryOptions {
  maxRetries?: number
  baseDelay?: number
  shouldRetry?: (error: unknown) => boolean
}

export interface RequestOptions {
  retry?: RetryOptions
  query?: Record<string, string>
}

export default interface IHttpTransport {
  postJson<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T>
  postText(path: string, body?: unknown, opts?: RequestOptions): Promise<string>
  patchJson<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T>
  getJson<T>(path: string, opts?: RequestOptions): Promise<T>
  getRaw(path: string): Promise<Response>
  del(path: string): Promise<void>
}
