import { hc } from 'hono/client'
import type { AppType } from '../../index'
import { clearApiKey, getApiKey } from './api'
import { getQueryClient } from './query-client'

export type ApiClient = ReturnType<typeof hc<AppType>>

let client: ApiClient | null = null

export function getApiClient(): ApiClient {
  if (!client) {
    client = hc<AppType>('/', {
      headers: (): Record<string, string> => {
        const key = getApiKey()
        if (key) return { Authorization: `Bearer ${key}` }
        return {}
      },
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        const res = await fetch(input, init)
        if (res.status === 401) {
          clearApiKey()
          getQueryClient().clear()
          resetApiClient()
          if (typeof window !== 'undefined') {
            window.location.href = '/key'
          }
        }
        return res
      },
    })
  }
  return client
}

export function resetApiClient(): void {
  client = null
}
