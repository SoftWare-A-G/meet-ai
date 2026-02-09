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

  async webSocketMessage() {}
  async webSocketClose() {}
  async webSocketError(ws: WebSocket) {
    try { ws.close(1011, 'unexpected error') } catch { /* already closed */ }
  }
}
