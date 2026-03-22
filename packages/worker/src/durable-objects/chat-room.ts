import { DurableObject } from 'cloudflare:workers'
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod/v4'
import { chatRoomBroadcastSchema, terminalSchema, commandsSchema, teamInfoSchema, teamInfoUpsertSchema, tasksFullReplaceSchema, createTaskSchema, updateTaskSchema, upsertTaskSchema, storedTeamInfoSchema, wsQuerySchema, wsIncomingMessageSchema } from '../schemas/chat-room'
import { jsonString } from '../schemas/helpers'
import type { StoredTask, StoredTeamInfo } from '../schemas/chat-room'
import type { TeamInfoPayload, TeamInfoUpsertPayload } from '../schemas/rooms'
import type { Bindings } from '../lib/types'

const STALE_TIMEOUT_MS = 120_000 // 2 minutes
const ALARM_INTERVAL_MS = 60_000 // check every 60s

function createApp(getChatRoom: () => ChatRoom) {
  return new Hono()
    .post('/broadcast', zValidator('json', chatRoomBroadcastSchema), (c) => {
      const room = getChatRoom()
      const event = c.req.valid('json')
      const data = JSON.stringify(event)
      const { sent, failed } = room.broadcastEvent(data)
      if (failed > 0) console.warn(`broadcast: ${sent} sent, ${failed} failed`)
      return c.json({ ok: true })
    })
    .post('/terminal', zValidator('json', terminalSchema), (c) => {
      const room = getChatRoom()
      const body = c.req.valid('json')
      room.broadcastAll(JSON.stringify(body))
      return c.json({ ok: true })
    })
    .post('/commands', zValidator('json', commandsSchema), async (c) => {
      const room = getChatRoom()
      const body = c.req.valid('json')
      const payload = JSON.stringify({ type: 'commands_info', ...body })
      await room.storeCommandsInfo(payload)
      room.broadcastAll(payload)
      return c.json({ ok: true })
    })
    .get('/team-info', async (c) => {
      const room = getChatRoom()
      const data = await room.getTeamInfo()
      return c.json(JSON.parse(data))
    })
    .post('/team-info', zValidator('json', teamInfoSchema), async (c) => {
      const room = getChatRoom()
      const body = c.req.valid('json')
      await room.storeTeamInfo(body)
      return c.json({ ok: true })
    })
    .post('/team-info/upsert', zValidator('json', teamInfoUpsertSchema), async (c) => {
      const room = getChatRoom()
      const body = c.req.valid('json')
      await room.upsertTeamMember(body.team_name, body.member)
      return c.json({ ok: true })
    })
    .get('/tasks', async (c) => {
      const room = getChatRoom()
      const tasks = await room.getTasks()
      return c.json({ tasks })
    })
    .post('/tasks', zValidator('json', tasksFullReplaceSchema), async (c) => {
      const room = getChatRoom()
      const body = c.req.valid('json')
      await room.replaceTasks(body)
      return c.json({ ok: true })
    })
    .post('/tasks/create', zValidator('json', createTaskSchema), async (c) => {
      const room = getChatRoom()
      const body = c.req.valid('json')
      const result = await room.createTask(body)
      return c.json(result.task)
    })
    .get('/tasks/:taskId', async (c) => {
      const room = getChatRoom()
      const task = await room.getTask(c.req.param('taskId'))
      if (!task) return c.json({ error: 'task not found' }, 404)
      return c.json(task)
    })
    .patch('/tasks/:taskId', zValidator('json', updateTaskSchema), async (c) => {
      const room = getChatRoom()
      const result = await room.updateTask(c.req.param('taskId'), c.req.valid('json'))
      if (!result) return c.json({ error: 'task not found' }, 404)
      return c.json(result)
    })
    .delete('/tasks/:taskId', async (c) => {
      const room = getChatRoom()
      const deleted = await room.deleteTask(c.req.param('taskId'))
      if (!deleted) return c.json({ error: 'task not found' }, 404)
      return c.json({ ok: true })
    })
    .post('/tasks/upsert', zValidator('json', upsertTaskSchema), async (c) => {
      const room = getChatRoom()
      const result = await room.upsertTask(c.req.valid('json'))
      if (!result) return c.json({ error: 'subject is required when creating a new task' }, 400)
      const status = result.upserted === 'created' ? 201 : 200
      return c.json(result, status)
    })
    .get('/ws', zValidator('query', wsQuerySchema), async (c) => {
      const room = getChatRoom()
      const query = c.req.valid('query')
      const client = await room.handleWebSocketUpgrade({
        clientType: query.client === 'cli' ? 'cli' : 'web',
        keyId: query.key_id,
        roomId: query.room_id,
      })
      return new Response(null, { status: 101, webSocket: client })
    })
    .delete('/destroy', async (c) => {
      await getChatRoom().destroy()
      return c.json({ ok: true as const })
    })
}

export type ChatRoomApp = ReturnType<typeof createApp>

export class ChatRoom extends DurableObject<Bindings> {
  private app = createApp(() => this)
  private teamInfo: string | null = null
  private tasksInfo: string | null = null
  private commandsInfo: string | null = null

  /** Broadcast a serialized event to all connected WebSocket clients. Returns { sent, failed } counts. */
  broadcastEvent(data: string): { sent: number; failed: number } {
    let sent = 0
    let failed = 0
    for (const ws of this.ctx.getWebSockets()) {
      try { ws.send(data); sent++ } catch { failed++ }
    }
    return { sent, failed }
  }

  /** Store commands info in durable storage and update the in-memory cache. */
  async storeCommandsInfo(payload: string): Promise<void> {
    this.commandsInfo = payload
    await this.ctx.storage.put('commandsInfo', payload)
  }

  /** Return cached or stored team info as a JSON string. */
  async getTeamInfo(): Promise<string> {
    if (!this.teamInfo) {
      this.teamInfo = (await this.ctx.storage.get<string>('teamInfo')) ?? null
    }
    return this.teamInfo ?? JSON.stringify({ type: 'team_info', members: [] })
  }

  /** Assign teammate_id to members without one, store and broadcast team info. */
  async storeTeamInfo(parsed: TeamInfoPayload): Promise<void> {
    const members = parsed.members.map(member => ({
      ...member,
      teammate_id: member.teammate_id ?? crypto.randomUUID(),
    }))
    const payload = JSON.stringify({ type: 'team_info', team_name: parsed.team_name, members })
    this.teamInfo = payload
    await this.ctx.storage.put('teamInfo', payload)
    this.broadcastAll(payload)
  }

  /** Merge a single member into team info by teammate_id, store and broadcast. */
  async upsertTeamMember(teamName: string, member: TeamInfoUpsertPayload['member']): Promise<void> {
    if (!this.teamInfo) {
      this.teamInfo = (await this.ctx.storage.get<string>('teamInfo')) ?? null
    }
    const current: StoredTeamInfo = this.teamInfo
      ? storedTeamInfoSchema.parse(JSON.parse(this.teamInfo))
      : { type: 'team_info' as const, team_name: teamName, members: [] }

    if (teamName) current.team_name = teamName

    const members = current.members
    const idx = members.findIndex(m => m.teammate_id === member.teammate_id)
    if (idx !== -1) {
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
    this.broadcastAll(payload)
  }

  private async updatePresenceKV(keyId: string, roomId: string, connected: boolean) {
    const kvKey = `presence:${keyId}`
    const raw = await this.env.PRESENCE.get(kvKey)
    const connectedRooms = new Set<string>(raw ? (JSON.parse(raw) as string[]) : [])
    if (connected) {
      connectedRooms.add(roomId)
    } else {
      connectedRooms.delete(roomId)
    }
    await this.env.PRESENCE.put(kvKey, JSON.stringify([...connectedRooms]), { expirationTtl: 600 })
  }

  broadcastAll(data: string) {
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(data)
      } catch {
        /* client gone */
      }
    }
  }

  private async loadTasks(): Promise<StoredTask[]> {
    if (!this.tasksInfo) {
      this.tasksInfo = (await this.ctx.storage.get<string>('tasksInfo')) ?? null
    }
    if (!this.tasksInfo) return []
    const parsed = JSON.parse(this.tasksInfo)
    return (parsed.tasks ?? []) as StoredTask[]
  }

  private async saveTasks(tasks: StoredTask[]) {
    const payload = JSON.stringify({ type: 'tasks_info', tasks })
    this.tasksInfo = payload
    await this.ctx.storage.put('tasksInfo', payload)
    this.broadcastAll(payload)
  }

  /** Return the current task list from cache or storage. */
  async getTasks(): Promise<StoredTask[]> {
    return this.loadTasks()
  }

  /** Full-replace the task list, store and broadcast. */
  async replaceTasks(parsed: { tasks: StoredTask[] }): Promise<void> {
    const payload = JSON.stringify({ type: 'tasks_info', ...parsed })
    this.tasksInfo = payload
    await this.ctx.storage.put('tasksInfo', payload)
    this.broadcastAll(payload)
  }

  /** Create a new task with dedup by source + source_id. */
  async createTask(input: z.infer<typeof createTaskSchema>): Promise<{ task: StoredTask; created: boolean }> {
    const tasks = await this.loadTasks()
    const assignee = input.assignee ?? null
    const source = input.source ?? 'meet_ai'
    const sourceId = input.source_id ?? null

    // Dedup: if source_id is provided, return existing task
    if (sourceId) {
      const existing = tasks.find(t => t.source === source && t.source_id === sourceId)
      if (existing) {
        return { task: existing, created: false }
      }
    }

    const newTask: StoredTask = {
      id: crypto.randomUUID().slice(0, 8),
      subject: input.subject,
      description: input.description,
      status: 'pending',
      assignee,
      owner: assignee,
      source,
      source_id: sourceId,
      updated_by: input.updated_by ?? null,
      updated_at: Date.now(),
    }
    tasks.push(newTask)
    await this.saveTasks(tasks)

    return { task: newTask, created: true }
  }

  /** Get a single task by ID, or null if not found. */
  async getTask(taskId: string): Promise<StoredTask | null> {
    const tasks = await this.loadTasks()
    return tasks.find(t => t.id === taskId) ?? null
  }

  /** Sparse-update a task by ID. Returns updated task, or null if not found. */
  async updateTask(taskId: string, body: z.infer<typeof updateTaskSchema>): Promise<StoredTask | null> {
    const tasks = await this.loadTasks()
    const idx = tasks.findIndex(t => t.id === taskId)
    if (idx === -1) return null

    const task = tasks[idx]
    if (body.subject !== undefined) task.subject = body.subject
    if (body.description !== undefined) task.description = body.description
    if (body.status !== undefined) task.status = body.status
    if (body.assignee !== undefined) {
      task.assignee = body.assignee ?? null
      task.owner = task.assignee
    }
    if (body.source !== undefined) task.source = body.source
    if (body.source_id !== undefined) task.source_id = body.source_id ?? null
    if (body.updated_by !== undefined) task.updated_by = body.updated_by ?? null
    task.updated_at = Date.now()

    tasks[idx] = task
    await this.saveTasks(tasks)
    return task
  }

  /** Delete a task by ID. Returns true if found and deleted, false otherwise. */
  async deleteTask(taskId: string): Promise<boolean> {
    const tasks = await this.loadTasks()
    const idx = tasks.findIndex(t => t.id === taskId)
    if (idx === -1) return false

    tasks.splice(idx, 1)
    await this.saveTasks(tasks)
    return true
  }

  /** Upsert a task by source + source_id. Creates if not found, updates if found. Returns null if subject missing on create. */
  async upsertTask(body: z.infer<typeof upsertTaskSchema>): Promise<(StoredTask & { upserted: 'created' | 'updated' }) | null> {
    const tasks = await this.loadTasks()
    const idx = tasks.findIndex(t => t.source === body.source && t.source_id === body.source_id)

    if (idx !== -1) {
      const task = tasks[idx]
      if (body.subject !== undefined) task.subject = body.subject
      if (body.description !== undefined) task.description = body.description
      if (body.status !== undefined) task.status = body.status
      if (body.assignee !== undefined) {
        task.assignee = body.assignee ?? null
        task.owner = task.assignee
      }
      if (body.updated_by !== undefined) task.updated_by = body.updated_by ?? null
      task.updated_at = Date.now()
      tasks[idx] = task
      await this.saveTasks(tasks)
      return { ...task, upserted: 'updated' }
    }

    if (!body.subject) return null

    const assignee = body.assignee ?? null
    const newTask: StoredTask = {
      id: crypto.randomUUID().slice(0, 8),
      subject: body.subject,
      description: body.description,
      status: body.status ?? 'pending',
      assignee,
      owner: assignee,
      source: body.source,
      source_id: body.source_id,
      updated_by: body.updated_by ?? null,
      updated_at: Date.now(),
    }
    tasks.push(newTask)
    await this.saveTasks(tasks)
    return { ...newTask, upserted: 'created' }
  }

  /** Handle a WebSocket upgrade: create pair, accept with hibernation, send cached state, schedule alarm. */
  async handleWebSocketUpgrade(params: { clientType: 'cli' | 'web'; keyId?: string | undefined; roomId?: string | undefined }): Promise<WebSocket> {
    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    this.ctx.acceptWebSocket(server, [params.clientType])

    if (params.clientType === 'cli' && params.keyId && params.roomId) {
      server.serializeAttachment({ keyId: params.keyId, roomId: params.roomId })
      await this.updatePresenceKV(params.keyId, params.roomId, true)
    }

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

    return client
  }

  /** Tear down the chat room: notify clients, close connections, wipe storage. */
  async destroy(): Promise<void> {
    const message = JSON.stringify({ type: 'room_deleted' })
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(message)
        ws.close(4040, 'room deleted')
      } catch {
        /* already closed */
      }
    }
    this.teamInfo = null
    this.tasksInfo = null
    this.commandsInfo = null
    await this.ctx.storage.deleteAll()
  }

  async fetch(request: Request): Promise<Response> {
    return this.app.fetch(request)
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

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    // Ping/pong handled by setWebSocketAutoResponse (edge-level, no DO wake).
    if (typeof message !== 'string') return

    const result = jsonString.pipe(wsIncomingMessageSchema).safeParse(message)
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

    // Broadcast validated subscription/resize events to all connected clients
    for (const sock of this.ctx.getWebSockets()) {
      try {
        sock.send(message)
      } catch {
        /* client gone */
      }
    }
  }

  async webSocketClose(ws: WebSocket, _code: number, _reason: string, _wasClean: boolean) {
    // Hibernation API handles cleanup — no need to call ws.close() again
    const attachment = ws.deserializeAttachment() as { keyId?: string; roomId?: string } | null
    if (attachment?.keyId && attachment?.roomId && this.ctx.getWebSockets('cli').length === 0) {
      await this.updatePresenceKV(attachment.keyId, attachment.roomId, false)
    }
  }

  async webSocketError(ws: WebSocket, _error: unknown) {
    try {
      ws.close(1011, 'unexpected error')
    } catch {
      /* already closed */
    }
  }
}
