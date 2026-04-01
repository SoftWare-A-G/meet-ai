import { isCodingAgentId } from '@meet-ai/cli/coding-agents'
import { catchApiError, parseError } from '@meet-ai/cli/domain/lib/api-errors'
import { mapMessage } from '@meet-ai/cli/domain/mappers/message'
import { Result } from 'better-result'
import type { ApiClient } from '@meet-ai/cli/domain/adapters/api-client'
import type IConnectionAdapter from '@meet-ai/cli/domain/interfaces/IConnectionAdapter'
import type { ListenOptions, LobbyOptions } from '@meet-ai/cli/domain/interfaces/IConnectionAdapter'
import type { Message } from '@meet-ai/cli/types'
import type { ApiError } from '@meet-ai/domain'

function wsLog(data: Record<string, unknown>) {
  const json = JSON.stringify({ ...data, ts: new Date().toISOString() })
  const isSuccess =
    data.event === 'connected' || data.event === 'reconnected' || data.event === 'catchup'
  console.error(isSuccess ? `\x1b[32m${json}\x1b[0m` : json)
}

export default class ConnectionAdapter implements IConnectionAdapter {
  constructor(
    private readonly client: ApiClient,
    private readonly baseUrl: string,
    private readonly apiKey?: string
  ) {}

  listen(roomId: string, options?: ListenOptions): WebSocket {
    const wsUrl = this.baseUrl.replace(/^http/, 'ws')
    const wsHeaders = this.apiKey
      ? { headers: { Authorization: `Bearer ${this.apiKey}` } }
      : undefined
    let pingInterval: ReturnType<typeof setInterval> | null = null
    let reconnectAttempt = 0

    const seen = new Set<string>()
    let lastSeenId: string | null = null
    const client = this.client

    function deliver(msg: Message) {
      if (seen.has(msg.id)) return
      seen.add(msg.id)
      if (seen.size > 200) {
        const first = seen.values().next().value!
        seen.delete(first)
      }
      lastSeenId = msg.id
      if (options?.exclude && msg.sender === options.exclude) return
      if (options?.senderType && msg.sender_type !== options.senderType) return
      if (options?.onMessage) {
        options.onMessage(msg)
      } else {
        console.log(JSON.stringify(msg))
      }
    }

    function getReconnectDelay() {
      const delay = Math.min(1000 * 2 ** Math.min(reconnectAttempt, 4), 15_000)
      reconnectAttempt++
      return delay + delay * 0.5 * Math.random()
    }

    function connect(): WebSocket {
      // Bun's WebSocket supports headers in the second argument (not in the standard spec)
      const ws = new WebSocket(
        `${wsUrl}/api/rooms/${roomId}/ws?client=cli`,
        wsHeaders as unknown as string[]
      )

      const connectTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          wsLog({ event: 'timeout', after_ms: 30_000 })
          try {
            ws.close(4000, 'connect timeout')
          } catch {}
          const delay = getReconnectDelay()
          wsLog({ event: 'reconnecting', attempt: reconnectAttempt, delay_ms: Math.round(delay) })
          setTimeout(connect, delay)
        }
      }, 30_000)

      ws.onopen = async () => {
        clearTimeout(connectTimeout)
        const wasReconnect = reconnectAttempt > 0
        reconnectAttempt = 0
        wsLog({ event: wasReconnect ? 'reconnected' : 'connected' })

        if (pingInterval) clearInterval(pingInterval)
        pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }))
          }
        }, 30_000)

        if (lastSeenId) {
          try {
            const query: Record<string, string> = { after: lastSeenId }
            if (options?.exclude) query.exclude = options.exclude
            if (options?.senderType) query.sender_type = options.senderType
            const res = await client.api.rooms[':id'].messages.$get({
              param: { id: roomId },
              query,
            })
            if (res.ok) {
              const data = await res.json()
              const missed = data.map(mapMessage)
              if (missed.length) wsLog({ event: 'catchup', count: missed.length })
              for (const msg of missed) deliver(msg)
            }
          } catch {
            // Catch-up failed — messages will arrive via WS or next reconnect
          }
        }
      }

      ws.onmessage = event => {
        const text =
          typeof event.data === 'string'
            ? event.data
            : new TextDecoder().decode(event.data as ArrayBuffer)
        const data = JSON.parse(text)
        if (data.type === 'pong') return
        if (data.type === 'room_deleted') {
          options?.onMessage?.(data as Message)
          return
        }
        if (
          data.type === 'terminal_subscribe' ||
          data.type === 'terminal_unsubscribe' ||
          data.type === 'tasks_info' ||
          data.type === 'team_info' ||
          data.type === 'commands_info'
        ) {
          options?.onMessage?.(data as Message)
          return
        }
        if (data.type === 'terminal_data') return
        deliver(data as Message)
      }

      ws.onclose = event => {
        clearTimeout(connectTimeout)
        if (pingInterval) clearInterval(pingInterval)

        const code = event.code
        if (code === 1000) {
          wsLog({ event: 'closed', code: 1000 })
          return
        }

        if (code === 4040) {
          wsLog({ event: 'closed', code: 4040, reason: 'room deleted' })
          console.error('Room deleted. Shutting down.')
          return
        }

        const reason =
          code === 1006
            ? 'network drop'
            : code === 1012
              ? 'service restart'
              : code === 1013
                ? 'server back-off'
                : `code ${code}`

        const delay = getReconnectDelay()
        wsLog({ event: 'disconnected', code, reason })
        wsLog({ event: 'reconnecting', attempt: reconnectAttempt, delay_ms: Math.round(delay) })
        setTimeout(connect, delay)
      }

      ws.onerror = () => {
        // onclose will fire after this, triggering reconnect
      }

      return ws
    }

    return connect()
  }

  listenLobby(options?: LobbyOptions): WebSocket {
    const wsUrl = this.baseUrl.replace(/^http/, 'ws')
    const wsHeaders = this.apiKey
      ? { headers: { Authorization: `Bearer ${this.apiKey}` } }
      : undefined
    let pingInterval: ReturnType<typeof setInterval> | null = null
    let reconnectAttempt = 0
    let reconnectScheduled = false
    const log = options?.silent ? () => {} : wsLog

    function getReconnectDelay() {
      const delay = Math.min(1000 * 2 ** Math.min(reconnectAttempt, 4), 15_000)
      reconnectAttempt++
      return delay + delay * 0.5 * Math.random()
    }

    function scheduleReconnect() {
      if (reconnectScheduled) return
      reconnectScheduled = true
      const delay = getReconnectDelay()
      log({ event: 'reconnecting', attempt: reconnectAttempt, delay_ms: Math.round(delay) })
      setTimeout(() => {
        reconnectScheduled = false
        connect()
      }, delay)
    }

    function connect(): WebSocket {
      // Bun's WebSocket supports headers in the second argument (not in the standard spec)
      const ws = new WebSocket(`${wsUrl}/api/lobby/ws`, wsHeaders as unknown as string[])

      const connectTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          try {
            ws.close(4000, 'connect timeout')
          } catch {}
          scheduleReconnect()
        }
      }, 30_000)

      ws.onopen = () => {
        clearTimeout(connectTimeout)
        reconnectAttempt = 0
        log({ event: 'lobby_connected' })

        if (pingInterval) clearInterval(pingInterval)
        pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }))
          }
        }, 30_000)
      }

      ws.onmessage = event => {
        const text =
          typeof event.data === 'string'
            ? event.data
            : new TextDecoder().decode(event.data as ArrayBuffer)
        try {
          const data = JSON.parse(text)
          if (data.type === 'pong') return
          if (data.type === 'room_created' && data.id && data.name) {
            options?.onRoomCreated?.(data.id, data.name)
          }
          if (data.type === 'room_deleted' && data.id) {
            options?.onRoomDeleted?.(data.id)
          }
          if (data.type === 'spawn_request' && data.room_name) {
            const codingAgent =
              typeof data.coding_agent === 'string' && isCodingAgentId(data.coding_agent)
                ? data.coding_agent
                : 'claude'
            options?.onSpawnRequest?.({ roomName: data.room_name, codingAgent })
          }
        } catch {
          // Ignore malformed messages
        }
      }

      ws.onclose = event => {
        clearTimeout(connectTimeout)
        if (pingInterval) clearInterval(pingInterval)

        if (event.code === 1000) return

        scheduleReconnect()
      }

      ws.onerror = () => {}

      return ws
    }

    return connect()
  }

  async generateKey(): Promise<Result<{ key: string; prefix: string }, ApiError>> {
    return Result.tryPromise({
      try: async () => {
        const res = await this.client.api.keys.$post()
        if (!res.ok) throw await parseError(res)
        return await res.json()
      },
      catch: catchApiError,
    })
  }
}
