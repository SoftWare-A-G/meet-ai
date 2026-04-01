import { ApiError } from '@meet-ai/domain'
import { Result } from 'better-result'

export function catchApiError(e: unknown): ApiError {
  return e instanceof ApiError ? e : new ApiError({ status: 0, message: String(e) })
}

export async function parseError(res: Response): Promise<ApiError> {
  try {
    const body = await res.json()
    const message = typeof body?.error === 'string' ? body.error : `HTTP ${res.status}`
    return new ApiError({ status: res.status, message })
  } catch {
    return new ApiError({ status: res.status, message: `HTTP ${res.status}` })
  }
}

export const RETRY = {
  retry: {
    times: 3,
    delayMs: 1000,
    backoff: 'exponential',
    shouldRetry: (e: unknown) => e instanceof ApiError && (e.status === 0 || e.status >= 500),
  },
} satisfies Parameters<typeof Result.tryPromise>[1]
