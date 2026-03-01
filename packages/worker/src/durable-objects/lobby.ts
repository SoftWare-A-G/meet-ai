import { DurableObject } from 'cloudflare:workers'

export class Lobby extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/ws') {
      const pair = new WebSocketPair()
      const [client, server] = Object.values(pair)
      this.ctx.acceptWebSocket(server)

      this.ctx.setWebSocketAutoResponse(
        new WebSocketRequestResponsePair(
          JSON.stringify({ type: 'ping' }),
          JSON.stringify({ type: 'pong' })
        )
      )

      return new Response(null, { status: 101, webSocket: client })
    }

    if (url.pathname === '/broadcast') {
      const data = await request.text()
      for (const ws of this.ctx.getWebSockets()) {
        try { ws.send(data) } catch { /* closed */ }
      }
      return new Response('ok')
    }

    return new Response('not found', { status: 404 })
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    try {
      const text = typeof message === 'string' ? message : new TextDecoder().decode(message)
      const data = JSON.parse(text)
      // Relay known control messages to all OTHER lobby clients
      if (data.type === 'spawn_request' && data.room_name) {
        for (const client of this.ctx.getWebSockets()) {
          if (client === ws) continue
          try { client.send(text) } catch { /* closed */ }
        }
      }
    } catch { /* ignore malformed messages */ }
  }
  async webSocketClose() {}
  async webSocketError(ws: WebSocket) {
    try { ws.close(1011, 'unexpected error') } catch { /* already closed */ }
  }
}
