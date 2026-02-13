import { DurableObject } from 'cloudflare:workers'

const STALE_TIMEOUT_MS = 120_000 // 2 minutes
const ALARM_INTERVAL_MS = 60_000 // check every 60s

export class ChatRoom extends DurableObject {
  private teamInfo: string | null = null
  private tasksInfo: string | null = null

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

      // Send cached team info to the new client (load from storage if cache is empty)
      if (!this.teamInfo) {
        this.teamInfo = await this.ctx.storage.get<string>('teamInfo') ?? null
      }
      if (this.teamInfo) {
        server.send(this.teamInfo)
      }

      // Send cached tasks info to the new client (load from storage if cache is empty)
      if (!this.tasksInfo) {
        this.tasksInfo = await this.ctx.storage.get<string>('tasksInfo') ?? null
      }
      if (this.tasksInfo) {
        server.send(this.tasksInfo)
      }

      // Schedule alarm to clean up stale connections
      const alarm = await this.ctx.storage.getAlarm()
      if (!alarm) {
        await this.ctx.storage.setAlarm(Date.now() + ALARM_INTERVAL_MS)
      }

      return new Response(null, { status: 101, webSocket: client })
    }

    // /broadcast — internal broadcast from Worker
    if (url.pathname === '/broadcast') {
      const data = await request.text()
      let sent = 0
      let failed = 0
      for (const ws of this.ctx.getWebSockets()) {
        try {
          ws.send(data)
          sent++
        } catch {
          failed++
        }
      }
      // 3.3 — Log broadcast failures
      if (failed > 0) {
        console.warn(`broadcast: ${sent} sent, ${failed} failed`)
      }
      return new Response('ok')
    }

    // /team-info — store and broadcast team info
    if (url.pathname === '/team-info') {
      const body = await request.text()
      const parsed = JSON.parse(body)
      const payload = JSON.stringify({ type: 'team_info', ...parsed })
      this.teamInfo = payload
      await this.ctx.storage.put('teamInfo', payload)

      for (const ws of this.ctx.getWebSockets()) {
        try {
          ws.send(payload)
        } catch { /* client gone */ }
      }

      return new Response('ok')
    }

    // /tasks — store and broadcast tasks info
    if (url.pathname === '/tasks') {
      const body = await request.text()
      const parsed = JSON.parse(body)
      const payload = JSON.stringify({ type: 'tasks_info', ...parsed })
      this.tasksInfo = payload
      await this.ctx.storage.put('tasksInfo', payload)

      for (const ws of this.ctx.getWebSockets()) {
        try {
          ws.send(payload)
        } catch { /* client gone */ }
      }

      return new Response('ok')
    }

    return new Response('not found', { status: 404 })
  }

  // 3.2 — Alarm-based stale connection cleanup
  async alarm() {
    const sockets = this.ctx.getWebSockets()
    const now = Date.now()
    let closed = 0

    for (const ws of sockets) {
      const lastPong = this.ctx.getWebSocketAutoResponseTimestamp(ws)
      if (lastPong && now - lastPong.getTime() > STALE_TIMEOUT_MS) {
        try { ws.close(1011, 'stale connection') } catch { /* already closed */ }
        closed++
      }
    }

    if (closed > 0) {
      console.log(`alarm: closed ${closed} stale connection(s)`)
    }

    // Reschedule if there are still active connections
    if (sockets.length - closed > 0) {
      await this.ctx.storage.setAlarm(Date.now() + ALARM_INTERVAL_MS)
    }
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
