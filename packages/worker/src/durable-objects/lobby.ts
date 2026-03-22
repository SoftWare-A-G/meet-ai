import { DurableObject } from 'cloudflare:workers'
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { lobbyBroadcastSchema, spawnRequestSchema } from '../schemas/lobby'
import { jsonString } from '../schemas/helpers'

function createApp(getLobby: () => Lobby) {
  return new Hono()
    .get('/ws', () => {
      const lobby = getLobby()
      const { client } = lobby.acceptWebSocket()
      return new Response(null, { status: 101, webSocket: client })
    })
    .post('/broadcast', zValidator('json', lobbyBroadcastSchema), (c) => {
      const lobby = getLobby()
      const payload = c.req.valid('json')
      lobby.broadcastEvent(JSON.stringify(payload))
      return c.json({ ok: true })
    })
}

export type LobbyApp = ReturnType<typeof createApp>

export class Lobby extends DurableObject {
  private app = createApp(() => this)

  /** Accept a WebSocket, configure auto-response, and return the client end. */
  acceptWebSocket(): { client: WebSocket } {
    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    this.ctx.acceptWebSocket(server)
    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair(
        JSON.stringify({ type: 'ping' }),
        JSON.stringify({ type: 'pong' })
      )
    )
    return { client }
  }

  /** Broadcast a serialized event to all connected WebSocket clients. */
  broadcastEvent(data: string): void {
    for (const ws of this.ctx.getWebSockets()) {
      try { ws.send(data) } catch { /* closed */ }
    }
  }

  async fetch(request: Request): Promise<Response> {
    return this.app.fetch(request)
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const text = typeof message === 'string' ? message : new TextDecoder().decode(message)

    const result = jsonString.pipe(spawnRequestSchema).safeParse(text)
    if (!result.success) {
      const isInvalidJson = result.error.issues.some(
        issue => issue.code === 'custom' && issue.message === 'Invalid JSON'
      )
      ws.send(JSON.stringify({
        type: 'error',
        error: isInvalidJson ? 'invalid_json' : 'invalid_message',
      }))
      return
    }
    // Relay known control messages to all OTHER lobby clients
    for (const client of this.ctx.getWebSockets()) {
      if (client === ws) continue
      try { client.send(text) } catch { /* closed */ }
    }
  }
  async webSocketClose() {}
  async webSocketError(ws: WebSocket) {
    try { ws.close(1011, 'unexpected error') } catch { /* already closed */ }
  }
}
