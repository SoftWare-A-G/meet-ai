import { DurableObject } from 'cloudflare:workers'

export class ChatRoom extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    // /ws — WebSocket upgrade
    if (url.pathname === '/ws') {
      const pair = new WebSocketPair()
      const [client, server] = Object.values(pair)
      this.ctx.acceptWebSocket(server)

      // Edge-level auto-response: pings are answered without waking the DO
      this.ctx.setWebSocketAutoResponse(
        new WebSocketRequestResponsePair(
          JSON.stringify({ type: 'ping' }),
          JSON.stringify({ type: 'pong' })
        )
      )

      return new Response(null, { status: 101, webSocket: client })
    }

    // /broadcast — internal broadcast from Worker
    if (url.pathname === '/broadcast') {
      const data = await request.text()
      for (const ws of this.ctx.getWebSockets()) {
        try {
          ws.send(data)
        } catch {
          /* client disconnected */
        }
      }
      return new Response('ok')
    }

    return new Response('not found', { status: 404 })
  }

  async webSocketMessage(_ws: WebSocket, _message: string | ArrayBuffer) {
    // Ping/pong handled by setWebSocketAutoResponse (edge-level, no DO wake).
    // All other client messages are ignored — messages must go through
    // the REST API (POST /api/rooms/:id/messages) which persists to D1
    // and then broadcasts via the /broadcast internal endpoint.
  }

  async webSocketClose(_ws: WebSocket, _code: number, _reason: string, _wasClean: boolean) {
    // Hibernation API handles cleanup — no need to call ws.close() again
  }

  async webSocketError(ws: WebSocket, _error: unknown) {
    try { ws.close(1011, 'unexpected error') } catch { /* already closed */ }
  }
}
