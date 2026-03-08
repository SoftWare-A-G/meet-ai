import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { queries } from '../db/queries'
import { requireAuth } from '../middleware/auth'
import { rateLimitByKey } from '../middleware/rate-limit'
import {
  createRoomSchema,
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

export const roomsRoute = new Hono<AppEnv>()

  // GET /api/rooms — list rooms scoped to this API key
  .get('/', requireAuth, async c => {
    const keyId = c.get('keyId')
    const db = queries(c.env.DB)
    const rooms = await db.listRooms(keyId)
    return c.json(rooms)
  })

  // POST /api/rooms — create a room
  .post('/', requireAuth, zValidator('json', createRoomSchema), async c => {
    const keyId = c.get('keyId')
    const body = c.req.valid('json')

    const id = crypto.randomUUID()
    const db = queries(c.env.DB)
    await db.insertRoom(id, keyId, body.name)

    // Notify lobby subscribers
    const doId = c.env.LOBBY.idFromName(keyId)
    const stub = c.env.LOBBY.get(doId)
    c.executionCtx.waitUntil(
      stub.fetch(
        new Request('http://internal/broadcast', {
          method: 'POST',
          body: JSON.stringify({ type: 'room_created', id, name: body.name }),
        })
      )
    )

    return c.json({ id, name: body.name }, 201)
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
  .patch('/:id/team-info/members', requireAuth, zValidator('json', teamInfoUpsertSchema), async c => {
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
  })

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
    const res = await stub.fetch(
      new Request('http://internal/tasks', { method: 'GET' })
    )
    const data = await res.json()
    return c.json(data)
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

    const task = await taskRes.json()
    return c.json(task)
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

    const task = await taskRes.json()
    return c.json(task)
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

  // DELETE /api/rooms/:id — delete a room and all its messages, logs, and attachments
  .delete('/:id', requireAuth, async c => {
    const keyId = c.get('keyId')
    const roomId = c.req.param('id')
    const db = queries(c.env.DB)

    const room = await db.findRoom(roomId, keyId)
    if (!room) {
      return c.json({ error: 'room not found' }, 404)
    }

    await db.deleteRoom(keyId, roomId)

    // Notify lobby subscribers
    const doId = c.env.LOBBY.idFromName(keyId)
    const stub = c.env.LOBBY.get(doId)
    c.executionCtx.waitUntil(
      stub.fetch(
        new Request('http://internal/broadcast', {
          method: 'POST',
          body: JSON.stringify({ type: 'room_deleted', id: roomId }),
        })
      )
    )

    return c.body(null, 204)
  })
