import { DurableObject } from 'cloudflare:workers'
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { lobbyBroadcastSchema, spawnRequestSchema } from '../schemas/lobby'

function createApp(getCtx: () => DurableObjectState) {
  return new Hono()
    .get('/ws', () => {
      const ctx = getCtx()
      const pair = new WebSocketPair()
      const [client, server] = Object.values(pair)
      ctx.acceptWebSocket(server)
      ctx.setWebSocketAutoResponse(
        new WebSocketRequestResponsePair(
          JSON.stringify({ type: 'ping' }),
          JSON.stringify({ type: 'pong' })
        )
      )
      return new Response(null, { status: 101, webSocket: client })
    })
    .post('/broadcast', zValidator('json', lobbyBroadcastSchema), (c) => {
      const ctx = getCtx()
      const payload = c.req.valid('json')
      const data = JSON.stringify(payload)
      for (const ws of ctx.getWebSockets()) {
        try { ws.send(data) } catch { /* closed */ }
      }
      return c.json({ ok: true })
    })
}

export type LobbyApp = ReturnType<typeof createApp>

export class Lobby extends DurableObject {
  private app = createApp(() => this.ctx)

  async fetch(request: Request): Promise<Response> {
    return this.app.fetch(request)
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const text = typeof message === 'string' ? message : new TextDecoder().decode(message)
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      ws.send(JSON.stringify({ type: 'error', error: 'invalid_json' }))
      return
    }
    const result = spawnRequestSchema.safeParse(parsed)
    if (!result.success) {
      ws.send(JSON.stringify({ type: 'error', error: 'invalid_message' }))
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
