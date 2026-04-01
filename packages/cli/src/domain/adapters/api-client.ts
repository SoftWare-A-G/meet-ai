import { hc } from 'hono/client'
import type { AppType } from '../../../../worker/src'

export type ApiClient = ReturnType<typeof hc<AppType>>

export function createApiClient(url: string, key?: string): ApiClient {
  return hc<AppType>(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    },
  })
}
