import type IHttpTransport from '@meet-ai/cli/domain/interfaces/IHttpTransport'
import type { RetryOptions, RequestOptions } from '@meet-ai/cli/domain/interfaces/IHttpTransport'

function isRetryable(error: unknown): boolean {
  if (error instanceof TypeError) return true
  if (error instanceof Error && /^HTTP 5\d{2}$/.test(error.message)) return true
  return false
}

export async function withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T> {
  const maxRetries = options?.maxRetries ?? 3
  const baseDelay = options?.baseDelay ?? 1000
  const shouldRetry = options?.shouldRetry ?? isRetryable

  let lastError: Error = new Error('withRetry: no attempts made')
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (attempt >= maxRetries || !shouldRetry(error)) throw lastError

      const delay = baseDelay * 2 ** attempt
      console.error(
        JSON.stringify({
          event: 'retry',
          attempt: attempt + 1,
          delay_ms: delay,
          error: lastError.message,
        })
      )
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  throw lastError
}

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const err = await res.json()
    const msg = (err as Record<string, unknown>).error
    if (typeof msg === 'string') return msg
    if (msg) return JSON.stringify(msg)
  } catch {
    // Response body not JSON-parsable
  }
  return `HTTP ${res.status}`
}

export default class HttpTransport implements IHttpTransport {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey?: string
  ) {}

  private headers(extra?: Record<string, string>): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json', ...extra }
    if (this.apiKey) {
      h['Authorization'] = `Bearer ${this.apiKey}`
    }
    return h
  }

  private authHeaders(): Record<string, string> | undefined {
    return this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : undefined
  }

  private buildUrl(path: string, query?: Record<string, string>): string {
    const params = new URLSearchParams()
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value) params.set(key, value)
      }
    }
    const qs = params.toString()
    return `${this.baseUrl}${path}${qs ? `?${qs}` : ''}`
  }

  async postJson<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T> {
    const doRequest = async () => {
      const res = await fetch(this.buildUrl(path, opts?.query), {
        method: 'POST',
        headers: this.headers(),
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })
      if (!res.ok) throw new Error(await parseErrorMessage(res))
      return res.json() as Promise<T>
    }

    return opts?.retry ? withRetry(doRequest, opts.retry) : doRequest()
  }

  async postText(path: string, body?: unknown, opts?: RequestOptions): Promise<string> {
    const doRequest = async () => {
      const res = await fetch(this.buildUrl(path, opts?.query), {
        method: 'POST',
        headers: this.headers(),
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })
      if (!res.ok) throw new Error(await parseErrorMessage(res))
      return res.text()
    }

    return opts?.retry ? withRetry(doRequest, opts.retry) : doRequest()
  }

  async patchJson<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T> {
    const doRequest = async () => {
      const res = await fetch(this.buildUrl(path, opts?.query), {
        method: 'PATCH',
        headers: this.headers(),
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })
      if (!res.ok) throw new Error(await parseErrorMessage(res))
      return res.json() as Promise<T>
    }

    return opts?.retry ? withRetry(doRequest, opts.retry) : doRequest()
  }

  async getJson<T>(path: string, opts?: RequestOptions): Promise<T> {
    const doRequest = async () => {
      const res = await fetch(this.buildUrl(path, opts?.query), {
        headers: this.authHeaders(),
      })
      if (!res.ok) throw new Error(await parseErrorMessage(res))
      return res.json() as Promise<T>
    }

    return opts?.retry ? withRetry(doRequest, opts.retry) : doRequest()
  }

  async getRaw(path: string): Promise<Response> {
    const res = await fetch(this.buildUrl(path), {
      headers: this.authHeaders(),
    })
    if (!res.ok) throw new Error(await parseErrorMessage(res))
    return res
  }

  async del(path: string): Promise<void> {
    const res = await fetch(this.buildUrl(path), {
      method: 'DELETE',
      headers: this.headers(),
    })
    if (!res.ok) throw new Error(await parseErrorMessage(res))
  }
}
