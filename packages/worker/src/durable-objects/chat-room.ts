import { DurableObject } from 'cloudflare:workers'

const STALE_TIMEOUT_MS = 120_000 // 2 minutes
const ALARM_INTERVAL_MS = 60_000 // check every 60s

export class ChatRoom extends DurableObject {
  private teamInfo: string | null = null
  private tasksInfo: string | null = null
  private commandsInfo: string | null = null

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
        this.teamInfo = (await this.ctx.storage.get<string>('teamInfo')) ?? null
      }
      if (this.teamInfo) {
        server.send(this.teamInfo)
      }

      // Send cached tasks info to the new client (load from storage if cache is empty)
      if (!this.tasksInfo) {
        this.tasksInfo = (await this.ctx.storage.get<string>('tasksInfo')) ?? null
      }
      if (this.tasksInfo) {
        server.send(this.tasksInfo)
      }

      // Send cached commands info to the new client (load from storage if cache is empty)
      if (!this.commandsInfo) {
        this.commandsInfo = (await this.ctx.storage.get<string>('commandsInfo')) ?? null
      }
      if (this.commandsInfo) {
        server.send(this.commandsInfo)
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
      if (Array.isArray(parsed.members)) {
        for (const member of parsed.members) {
          if (!member.teammate_id) {
            member.teammate_id = crypto.randomUUID()
          }
        }
      }
      const payload = JSON.stringify({ type: 'team_info', ...parsed })
      this.teamInfo = payload
      await this.ctx.storage.put('teamInfo', payload)

      for (const ws of this.ctx.getWebSockets()) {
        try {
          ws.send(payload)
        } catch {
          /* client gone */
        }
      }

      return new Response('ok')
    }

    // /team-info/upsert — merge a single member into team info
    if (url.pathname === '/team-info/upsert') {
      const body = JSON.parse(await request.text())
      const { team_name, member } = body

      // Load existing team info
      if (!this.teamInfo) {
        this.teamInfo = (await this.ctx.storage.get<string>('teamInfo')) ?? null
      }

      const current = this.teamInfo
        ? JSON.parse(this.teamInfo)
        : { type: 'team_info', team_name, members: [] }

      // Update team_name if provided
      if (team_name) current.team_name = team_name

      // Upsert: find by teammate_id, replace or append
      const members: { teammate_id: string; name: string; color: string; role: string; model: string; status: string; joinedAt: number }[] = current.members ?? []
      const idx = members.findIndex(m => m.teammate_id === member.teammate_id)
      if (idx !== -1) {
        // Selective merge: preserve existing values when new values are placeholders
        const updated = { ...members[idx] }
        if (member.name) updated.name = member.name
        if (member.status) updated.status = member.status
        if (member.color && member.color !== '#555') updated.color = member.color
        if (member.model && member.model !== 'unknown') updated.model = member.model
        if (member.role) updated.role = member.role
        if (member.joinedAt > 0) updated.joinedAt = member.joinedAt
        members[idx] = updated
      } else {
        members.push(member)
      }
      current.members = members

      const payload = JSON.stringify(current)
      this.teamInfo = payload
      await this.ctx.storage.put('teamInfo', payload)

      for (const ws of this.ctx.getWebSockets()) {
        try {
          ws.send(payload)
        } catch {
          /* client gone */
        }
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
        } catch {
          /* client gone */
        }
      }

      return new Response('ok')
    }

    // /tasks/create — create a new task, append to list, broadcast
    if (url.pathname === '/tasks/create') {
      let body: Record<string, unknown>
      try {
        body = JSON.parse(await request.text())
      } catch {
        return new Response(JSON.stringify({ error: 'invalid JSON' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      if (typeof body.subject !== 'string' || body.subject.trim() === '') {
        return new Response(
          JSON.stringify({ error: 'subject is required and must be a non-empty string' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      }
      if (body.description !== undefined && typeof body.description !== 'string') {
        return new Response(JSON.stringify({ error: 'description must be a string' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      // Load current tasks
      if (!this.tasksInfo) {
        this.tasksInfo = (await this.ctx.storage.get<string>('tasksInfo')) ?? null
      }
      const current = this.tasksInfo
        ? JSON.parse(this.tasksInfo)
        : { type: 'tasks_info', tasks: [] }
      const tasks: {
        id: string
        subject: string
        description?: string
        status: string
        owner: string | null
      }[] = current.tasks ?? []

      const newTask = {
        id: crypto.randomUUID().slice(0, 8),
        subject: body.subject,
        ...(body.description && { description: body.description as string }),
        status: 'pending' as const,
        owner: null,
      }
      tasks.push(newTask)

      const payload = JSON.stringify({ type: 'tasks_info', tasks })
      this.tasksInfo = payload
      await this.ctx.storage.put('tasksInfo', payload)

      for (const ws of this.ctx.getWebSockets()) {
        try {
          ws.send(payload)
        } catch {
          /* client gone */
        }
      }

      return new Response(JSON.stringify(newTask), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // /commands — store and broadcast commands info
    if (url.pathname === '/commands') {
      const body = await request.text()
      const parsed = JSON.parse(body)
      const payload = JSON.stringify({ type: 'commands_info', ...parsed })
      this.commandsInfo = payload
      await this.ctx.storage.put('commandsInfo', payload)

      for (const ws of this.ctx.getWebSockets()) {
        try {
          ws.send(payload)
        } catch {
          /* client gone */
        }
      }

      return new Response('ok')
    }

    // /terminal — broadcast terminal data to all WebSocket clients
    if (url.pathname === '/terminal') {
      const body = await request.text()
      for (const ws of this.ctx.getWebSockets()) {
        try {
          ws.send(body)
        } catch {
          /* client gone */
        }
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
        try {
          ws.close(1011, 'stale connection')
        } catch {
          /* already closed */
        }
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

  async webSocketMessage(_ws: WebSocket, message: string | ArrayBuffer) {
    // Ping/pong handled by setWebSocketAutoResponse (edge-level, no DO wake).
    if (typeof message !== 'string') return

    let parsed: { type?: string; paneId?: string }
    try {
      parsed = JSON.parse(message)
    } catch {
      return
    }

    if (parsed.type === 'terminal_subscribe' || parsed.type === 'terminal_unsubscribe' || parsed.type === 'terminal_resize') {
      // Broadcast subscription events to all connected clients
      for (const ws of this.ctx.getWebSockets()) {
        try {
          ws.send(message)
        } catch {
          /* client gone */
        }
      }
    }
  }

  async webSocketClose(_ws: WebSocket, _code: number, _reason: string, _wasClean: boolean) {
    // Hibernation API handles cleanup — no need to call ws.close() again
  }

  async webSocketError(ws: WebSocket, _error: unknown) {
    try {
      ws.close(1011, 'unexpected error')
    } catch {
      /* already closed */
    }
  }
}
