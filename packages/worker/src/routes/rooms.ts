import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { queries } from '../db/queries'
import { requireAuth } from '../middleware/auth'
import { rateLimitByKey } from '../middleware/rate-limit'
import {
  createRoomSchema,
  updateRoomSchema,
  sendMessageSchema,
  sendLogSchema,
  teamInfoSchema,
  teamInfoUpsertSchema,
  messagesQuerySchema,
  commandsSchema,
  createTaskSchema,
  updateTaskSchema,
  upsertTaskSchema,
  terminalDataSchema,
} from '../schemas/rooms'
import type { AppEnv } from '../lib/types'
import { createDOClient } from '../lib/do-client'
import type { LobbyApp } from '../durable-objects/lobby'
import type { CanvasRoomApp } from '../durable-objects/canvas-room'
import type { ChatRoomApp } from '../durable-objects/chat-room'
import type { TeamInfoPayload } from '../schemas/rooms'

type TaskPayload = {
  id: string
  subject: string
  description?: string
  status: 'pending' | 'in_progress' | 'completed'
  assignee: string | null
  owner: string | null
  source: 'claude' | 'codex' | 'pi' | 'meet_ai'
  source_id: string | null
  updated_by: string | null
  updated_at: number
}

type TasksPayload = {
  type: 'tasks_info'
  tasks: TaskPayload[]
}

export const roomsRoute = new Hono<AppEnv>()

  // GET /api/rooms — list rooms scoped to this API key
  .get('/', requireAuth, async c => {
    const keyId = c.get('keyId')
    const projectId = c.req.query('project_id')
    const db = queries(c.env.DB)
    const [rooms, presenceRaw] = await Promise.all([
      db.listRooms(keyId, projectId || undefined),
      c.env.PRESENCE.get(`presence:${keyId}`),
    ])
    const connectedRooms = new Set<string>(presenceRaw ? (JSON.parse(presenceRaw) as string[]) : [])
    return c.json(rooms.map(room => ({ ...room, connected: connectedRooms.has(room.id) })))
  })

  // POST /api/rooms — create a room
  .post('/', requireAuth, zValidator('json', createRoomSchema), async c => {
    const keyId = c.get('keyId')
    const body = c.req.valid('json')

    const id = crypto.randomUUID()
    const db = queries(c.env.DB)
    let projectName: string | null = null
    let projectCreatedAt: string | null = null
    let projectUpdatedAt: string | null = null

    // Validate project exists if project_id is provided
    if (body.project_id) {
      const project = await db.findProject(body.project_id, keyId)
      if (!project) {
        return c.json({ error: 'project not found' }, 404)
      }
      projectName = project.name
      projectCreatedAt = project.created_at
      projectUpdatedAt = project.updated_at
    }

    const room = await db.insertRoom(id, keyId, body.name, body.project_id)

    // Notify lobby subscribers
    const lobbyDoId = c.env.LOBBY.idFromName(keyId)
    const lobbyStub = c.env.LOBBY.get(lobbyDoId)
    const lobbyClient = createDOClient<LobbyApp>(lobbyStub)
    c.executionCtx.waitUntil(
      lobbyClient.broadcast.$post({
        json: {
          type: 'room_created',
          id,
          name: body.name,
          created_at: room.created_at,
          project_id: body.project_id ?? null,
          project_name: projectName,
          project_created_at: projectCreatedAt,
          project_updated_at: projectUpdatedAt,
        },
      })
    )

    return c.json(room, 201)
  })

  // GET /api/rooms/:id/messages — get message history
  .get('/:id/messages', requireAuth, zValidator('query', messagesQuerySchema), async c => {
    const keyId = c.get('keyId')
    const roomId = c.req.param('id')
    const db = queries(c.env.DB)

    const room = await db.findRoom(roomId, keyId)
    if (!room) {
      return c.json({ error: 'room not found' }, 404)
    }

    const { after, since_seq: sinceSeq, exclude, sender_type: senderType } = c.req.valid('query')

    // Prefer since_seq (cheaper query) over after (rowid subquery)
    if (sinceSeq != null) {
      const messages = await db.listMessagesSinceSeq(
        roomId,
        sinceSeq,
        exclude || undefined,
        senderType || undefined
      )
      return c.json(messages)
    }

    const messages = await db.listMessages(
      roomId,
      after || undefined,
      exclude || undefined,
      senderType || undefined
    )
    return c.json(messages)
  })

  // POST /api/rooms/:id/messages — send a message (60/min per key)
  .post(
    '/:id/messages',
    requireAuth,
    rateLimitByKey(60, 60_000),
    zValidator('json', sendMessageSchema),
    async c => {
      const keyId = c.get('keyId')
      const roomId = c.req.param('id')
      const db = queries(c.env.DB)

      const room = await db.findRoom(roomId, keyId)
      if (!room) {
        return c.json({ error: 'room not found' }, 404)
      }

      const body = c.req.valid('json')

      const senderType = body.sender_type === 'agent' ? 'agent' : 'human'
      const color = body.color || null
      const id = crypto.randomUUID()
      const seq = await db.insertMessage(
        id,
        roomId,
        body.sender,
        body.content,
        senderType,
        color ?? undefined
      )

      // Link attachments atomically before broadcast
      const attachmentIds = body.attachment_ids ?? []
      let attachmentCount = 0
      for (const attId of attachmentIds) {
        const linked = await db.linkAttachmentToMessage(attId, keyId, id)
        if (linked) attachmentCount++
      }

      const message = {
        id,
        room_id: roomId,
        sender: body.sender,
        sender_type: senderType,
        content: body.content,
        color,
        type: 'message' as const,
        seq,
        created_at: new Date().toISOString(),
        attachment_count: attachmentCount,
      }

      // Broadcast via Durable Object
      const doId = c.env.CHAT_ROOM.idFromName(`${keyId}:${roomId}`)
      const stub = c.env.CHAT_ROOM.get(doId)
      c.executionCtx.waitUntil(
        stub.fetch(
          new Request('http://internal/broadcast', {
            method: 'POST',
            body: JSON.stringify(message),
          })
        )
      )

      return c.json(message, 201)
    }
  )

  // GET /api/rooms/:id/logs — get recent logs
  .get('/:id/logs', requireAuth, async c => {
    const keyId = c.get('keyId')
    const roomId = c.req.param('id')
    const db = queries(c.env.DB)

    const room = await db.findRoom(roomId, keyId)
    if (!room) {
      return c.json({ error: 'room not found' }, 404)
    }

    const logs = await db.getLogsByRoom(keyId, roomId)
    return c.json(logs)
  })

  // POST /api/rooms/:id/logs — send a log message (60/min per key)
  .post(
    '/:id/logs',
    requireAuth,
    rateLimitByKey(60, 60_000),
    zValidator('json', sendLogSchema),
    async c => {
      const keyId = c.get('keyId')
      const roomId = c.req.param('id')
      const db = queries(c.env.DB)

      const room = await db.findRoom(roomId, keyId)
      if (!room) {
        return c.json({ error: 'room not found' }, 404)
      }

      const body = c.req.valid('json')

      const color = body.color || null
      const messageId = body.message_id || null
      const id = crypto.randomUUID()
      await db.insertLog(
        id,
        keyId,
        roomId,
        body.sender,
        body.content,
        color ?? undefined,
        messageId ?? undefined
      )

      const log = {
        id,
        room_id: roomId,
        message_id: messageId,
        sender: body.sender,
        content: body.content,
        color,
        type: 'log' as const,
        created_at: new Date().toISOString(),
      }

      // Broadcast via Durable Object
      const doId = c.env.CHAT_ROOM.idFromName(`${keyId}:${roomId}`)
      const stub = c.env.CHAT_ROOM.get(doId)
      c.executionCtx.waitUntil(
        stub.fetch(
          new Request('http://internal/broadcast', {
            method: 'POST',
            body: JSON.stringify(log),
          })
        )
      )

      return c.json(log, 201)
    }
  )

  // GET /api/rooms/:id/attachment-counts — get attachment counts per message
  .get('/:id/attachment-counts', requireAuth, async c => {
    const keyId = c.get('keyId')
    const roomId = c.req.param('id')
    const db = queries(c.env.DB)

    const room = await db.findRoom(roomId, keyId)
    if (!room) {
      return c.json({ error: 'room not found' }, 404)
    }

    const counts = await db.countAttachmentsByRoom(roomId)
    const map: Record<string, number> = {}
    for (const row of counts) {
      map[row.message_id] = row.count
    }
    return c.json(map)
  })

  // GET /api/rooms/:id/team-info — get current team info
  .get('/:id/team-info', requireAuth, async c => {
    const keyId = c.get('keyId')
    const roomId = c.req.param('id')
    const db = queries(c.env.DB)

    const room = await db.findRoom(roomId, keyId)
    if (!room) {
      return c.json({ error: 'room not found' }, 404)
    }

    const doId = c.env.CHAT_ROOM.idFromName(`${keyId}:${roomId}`)
    const stub = c.env.CHAT_ROOM.get(doId)
    const res = await stub.fetch(new Request('http://internal/team-info', { method: 'GET' }))
    const data = (await res.json()) as TeamInfoPayload
    return c.json<TeamInfoPayload>(data)
  })

  // POST /api/rooms/:id/team-info — push team info to ChatRoom DO
  .post('/:id/team-info', requireAuth, zValidator('json', teamInfoSchema), async c => {
    const keyId = c.get('keyId')
    const roomId = c.req.param('id')
    const db = queries(c.env.DB)

    const room = await db.findRoom(roomId, keyId)
    if (!room) {
      return c.json({ error: 'room not found' }, 404)
    }

    const body = c.req.valid('json')

    const doId = c.env.CHAT_ROOM.idFromName(`${keyId}:${roomId}`)
    const stub = c.env.CHAT_ROOM.get(doId)
    await stub.fetch(
      new Request('http://internal/team-info', {
        method: 'POST',
        body: JSON.stringify(body),
      })
    )

    return c.json({ ok: true })
  })

  // PATCH /api/rooms/:id/team-info/members — upsert a single team member
  .patch(
    '/:id/team-info/members',
    requireAuth,
    zValidator('json', teamInfoUpsertSchema),
    async c => {
      const keyId = c.get('keyId')
      const roomId = c.req.param('id')
      const db = queries(c.env.DB)

      const room = await db.findRoom(roomId, keyId)
      if (!room) {
        return c.json({ error: 'room not found' }, 404)
      }

      const body = c.req.valid('json')

      const doId = c.env.CHAT_ROOM.idFromName(`${keyId}:${roomId}`)
      const stub = c.env.CHAT_ROOM.get(doId)
      await stub.fetch(
        new Request('http://internal/team-info/upsert', {
          method: 'POST',
          body: JSON.stringify(body),
        })
      )

      return c.json({ ok: true })
    }
  )

  // POST /api/rooms/:id/commands — push commands info to ChatRoom DO
  .post('/:id/commands', requireAuth, zValidator('json', commandsSchema), async c => {
    const keyId = c.get('keyId')
    const roomId = c.req.param('id')
    const db = queries(c.env.DB)

    const room = await db.findRoom(roomId, keyId)
    if (!room) {
      return c.json({ error: 'room not found' }, 404)
    }

    const body = c.req.valid('json')

    const doId = c.env.CHAT_ROOM.idFromName(`${keyId}:${roomId}`)
    const stub = c.env.CHAT_ROOM.get(doId)
    await stub.fetch(
      new Request('http://internal/commands', {
        method: 'POST',
        body: JSON.stringify(body),
      })
    )

    return c.json({ ok: true })
  })

  // POST /api/rooms/:id/tasks — push tasks info to ChatRoom DO
  .post('/:id/tasks', requireAuth, async c => {
    const keyId = c.get('keyId')
    const roomId = c.req.param('id')
    const db = queries(c.env.DB)

    const room = await db.findRoom(roomId, keyId)
    if (!room) {
      return c.json({ error: 'room not found' }, 404)
    }

    const body = await c.req.json()

    const doId = c.env.CHAT_ROOM.idFromName(`${keyId}:${roomId}`)
    const stub = c.env.CHAT_ROOM.get(doId)
    await stub.fetch(
      new Request('http://internal/tasks', {
        method: 'POST',
        body: JSON.stringify(body),
      })
    )

    return c.json({ ok: true })
  })

  // POST /api/rooms/:id/tasks/create — create a task from web UI
  .post('/:id/tasks/create', requireAuth, zValidator('json', createTaskSchema), async c => {
    const keyId = c.get('keyId')
    const roomId = c.req.param('id')
    const db = queries(c.env.DB)

    const room = await db.findRoom(roomId, keyId)
    if (!room) {
      return c.json({ error: 'room not found' }, 404)
    }

    const body = c.req.valid('json')

    const doId = c.env.CHAT_ROOM.idFromName(`${keyId}:${roomId}`)
    const stub = c.env.CHAT_ROOM.get(doId)

    // Create task in DO
    const taskRes = await stub.fetch(
      new Request('http://internal/tasks/create', {
        method: 'POST',
        body: JSON.stringify(body),
      })
    )
    const task = await taskRes.json()

    // Send a chat message announcing the new task
    const msgId = crypto.randomUUID()
    const seq = await db.insertMessage(
      msgId,
      roomId,
      'system',
      `New task created: ${body.subject}`,
      'agent'
    )

    const message = {
      id: msgId,
      room_id: roomId,
      sender: 'system',
      sender_type: 'agent' as const,
      content: `New task created: ${body.subject}`,
      color: null,
      type: 'message' as const,
      seq,
      created_at: new Date().toISOString(),
      attachment_count: 0,
    }

    c.executionCtx.waitUntil(
      stub.fetch(
        new Request('http://internal/broadcast', {
          method: 'POST',
          body: JSON.stringify(message),
        })
      )
    )

    return c.json({ ok: true, task }, 201)
  })

  // GET /api/rooms/:id/tasks — get current task list
  .get('/:id/tasks', requireAuth, async c => {
    const keyId = c.get('keyId')
    const roomId = c.req.param('id')
    const db = queries(c.env.DB)

    const room = await db.findRoom(roomId, keyId)
    if (!room) {
      return c.json({ error: 'room not found' }, 404)
    }

    const doId = c.env.CHAT_ROOM.idFromName(`${keyId}:${roomId}`)
    const stub = c.env.CHAT_ROOM.get(doId)
    const res = await stub.fetch(new Request('http://internal/tasks', { method: 'GET' }))
    return c.json<TasksPayload>(await res.json())
  })

  // GET /api/rooms/:id/tasks/:taskId — get a single task
  .get('/:id/tasks/:taskId', requireAuth, async c => {
    const keyId = c.get('keyId')
    const roomId = c.req.param('id')
    const taskId = c.req.param('taskId')
    const db = queries(c.env.DB)

    const room = await db.findRoom(roomId, keyId)
    if (!room) {
      return c.json({ error: 'room not found' }, 404)
    }

    const doId = c.env.CHAT_ROOM.idFromName(`${keyId}:${roomId}`)
    const stub = c.env.CHAT_ROOM.get(doId)
    const taskRes = await stub.fetch(
      new Request(`http://internal/tasks/${taskId}`, { method: 'GET' })
    )

    if (taskRes.status === 404) {
      return c.json({ error: 'task not found' }, 404)
    }

    return c.json<TaskPayload>(await taskRes.json())
  })

  // PATCH /api/rooms/:id/tasks/:taskId — update a task
  .patch('/:id/tasks/:taskId', requireAuth, zValidator('json', updateTaskSchema), async c => {
    const keyId = c.get('keyId')
    const roomId = c.req.param('id')
    const taskId = c.req.param('taskId')
    const db = queries(c.env.DB)

    const room = await db.findRoom(roomId, keyId)
    if (!room) {
      return c.json({ error: 'room not found' }, 404)
    }

    const body = c.req.valid('json')

    const doId = c.env.CHAT_ROOM.idFromName(`${keyId}:${roomId}`)
    const stub = c.env.CHAT_ROOM.get(doId)
    const taskRes = await stub.fetch(
      new Request(`http://internal/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
    )

    if (taskRes.status === 404) {
      return c.json({ error: 'task not found' }, 404)
    }

    return c.json<TaskPayload>(await taskRes.json())
  })

  // DELETE /api/rooms/:id/tasks/:taskId — delete a task
  .delete('/:id/tasks/:taskId', requireAuth, async c => {
    const keyId = c.get('keyId')
    const roomId = c.req.param('id')
    const taskId = c.req.param('taskId')
    const db = queries(c.env.DB)

    const room = await db.findRoom(roomId, keyId)
    if (!room) {
      return c.json({ error: 'room not found' }, 404)
    }

    const doId = c.env.CHAT_ROOM.idFromName(`${keyId}:${roomId}`)
    const stub = c.env.CHAT_ROOM.get(doId)
    const taskRes = await stub.fetch(
      new Request(`http://internal/tasks/${taskId}`, {
        method: 'DELETE',
      })
    )

    if (taskRes.status === 404) {
      return c.json({ error: 'task not found' }, 404)
    }

    return c.json({ ok: true })
  })

  // POST /api/rooms/:id/tasks/upsert — upsert a task by source + source_id
  .post('/:id/tasks/upsert', requireAuth, zValidator('json', upsertTaskSchema), async c => {
    const keyId = c.get('keyId')
    const roomId = c.req.param('id')
    const db = queries(c.env.DB)

    const room = await db.findRoom(roomId, keyId)
    if (!room) {
      return c.json({ error: 'room not found' }, 404)
    }

    const body = c.req.valid('json')

    const doId = c.env.CHAT_ROOM.idFromName(`${keyId}:${roomId}`)
    const stub = c.env.CHAT_ROOM.get(doId)
    const taskRes = await stub.fetch(
      new Request('http://internal/tasks/upsert', {
        method: 'POST',
        body: JSON.stringify(body),
      })
    )

    const task = await taskRes.json()
    return c.json(task, taskRes.status === 201 ? 201 : 200)
  })

  // POST /api/rooms/:id/spawn — request to spawn an orchestrator for this room
  .post('/:id/spawn', requireAuth, async c => {
    const keyId = c.get('keyId')
    const roomId = c.req.param('id')
    const db = queries(c.env.DB)

    const room = await db.findRoom(roomId, keyId)
    if (!room) {
      return c.json({ error: 'room not found' }, 404)
    }

    // Generate a unique spawn token
    const spawnToken = crypto.randomUUID()

    // Return spawn configuration
    // The actual spawning happens client-side or on a separate service
    // that has Claude Code installed
    return c.json({
      roomId,
      spawnToken,
      ready: true,
      config: {
        roomId,
        roomName: room.name,
        apiUrl: `${c.req.url.split('/api')[0]}`,
      },
    })
  })

  // POST /api/rooms/:id/terminal — stream terminal data to WebSocket clients
  .post('/:id/terminal', requireAuth, zValidator('json', terminalDataSchema), async c => {
    const keyId = c.get('keyId')
    const roomId = c.req.param('id')
    const db = queries(c.env.DB)

    const room = await db.findRoom(roomId, keyId)
    if (!room) {
      return c.json({ error: 'room not found' }, 404)
    }

    const body = c.req.valid('json')

    const doId = c.env.CHAT_ROOM.idFromName(`${keyId}:${roomId}`)
    const stub = c.env.CHAT_ROOM.get(doId)
    c.executionCtx.waitUntil(
      stub.fetch(
        new Request('http://internal/terminal', {
          method: 'POST',
          body: JSON.stringify({ type: 'terminal_data', data: body.data }),
        })
      )
    )

    return c.json({ ok: true })
  })

  // PATCH /api/rooms/:id — update room name and/or project
  .patch('/:id', requireAuth, zValidator('json', updateRoomSchema), async c => {
    const keyId = c.get('keyId')
    const roomId = c.req.param('id')
    const body = c.req.valid('json')
    const db = queries(c.env.DB)

    // Validate project exists if project_id is provided
    if (body.project_id) {
      const project = await db.findProject(body.project_id, keyId)
      if (!project) {
        return c.json({ error: 'project not found' }, 422)
      }
    }

    const updated = await db.updateRoom(roomId, keyId, {
      name: body.name,
      projectId: body.project_id,
    })

    if (!updated) {
      return c.json({ error: 'room not found' }, 404)
    }

    return c.json(updated)
  })

  // DELETE /api/rooms/:id — delete a room and all its messages, logs, and attachments
  .delete('/:id', requireAuth, async c => {
    const keyId = c.get('keyId')
    const roomId = c.req.param('id')
    const db = queries(c.env.DB)

    const room = await db.findRoom(roomId, keyId)
    if (!room) {
      return c.json({ error: 'room not found' }, 404)
    }

    // Clean up CanvasRoom DO storage and R2 assets before deleting D1 metadata
    const canvas = await db.findCanvasByRoom(roomId, keyId)
    if (canvas) {
      // Destroy CanvasRoom DO (closes sessions, wipes SQLite storage)
      const canvasDoId = c.env.CANVAS_ROOM.idFromName(`${keyId}:${canvas.id}`)
      const canvasStub = c.env.CANVAS_ROOM.get(canvasDoId)
      const canvasClient = createDOClient<CanvasRoomApp>(canvasStub)
      await canvasClient.destroy.$delete({}, { headers: { 'X-Room-Id': roomId } })
    }

    // Destroy ChatRoom DO (notifies clients, closes WebSockets, wipes storage)
    const chatDoId = c.env.CHAT_ROOM.idFromName(`${keyId}:${roomId}`)
    const chatStub = c.env.CHAT_ROOM.get(chatDoId)
    const chatClient = createDOClient<ChatRoomApp>(chatStub)
    await chatClient.destroy.$delete()

    await db.deleteRoom(keyId, roomId)

    // Notify lobby subscribers
    const lobbyDoId = c.env.LOBBY.idFromName(keyId)
    const lobbyStub = c.env.LOBBY.get(lobbyDoId)
    const lobbyClient = createDOClient<LobbyApp>(lobbyStub)
    c.executionCtx.waitUntil(
      lobbyClient.broadcast.$post({
        json: { type: 'room_deleted', id: roomId },
      })
    )

    return c.body(null, 204)
  })
