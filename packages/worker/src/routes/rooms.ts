import { Hono } from 'hono'
import { queries } from '../db/queries'
import { requireAuth } from '../middleware/auth'
import { rateLimitByKey } from '../middleware/rate-limit'
import type { AppEnv, TeamInfo } from '../lib/types'

export const roomsRoute = new Hono<AppEnv>()

  // GET /api/rooms — list rooms scoped to this API key
  .get('/', requireAuth, async c => {
    const keyId = c.get('keyId')
    const db = queries(c.env.DB)
    const rooms = await db.listRooms(keyId)
    return c.json(rooms)
  })

  // POST /api/rooms — create a room
  .post('/', requireAuth, async c => {
    const keyId = c.get('keyId')
    const body = await c.req.json<{ name?: string }>()
    if (!body.name) {
      return c.json({ error: 'name is required' }, 400)
    }

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
  .get('/:id/messages', requireAuth, async c => {
    const keyId = c.get('keyId')
    const roomId = c.req.param('id')
    const db = queries(c.env.DB)

    const room = await db.findRoom(roomId, keyId)
    if (!room) {
      return c.json({ error: 'room not found' }, 404)
    }

    const after = c.req.query('after')
    const sinceSeq = c.req.query('since_seq')
    const exclude = c.req.query('exclude')
    const senderType = c.req.query('sender_type')

    // Prefer since_seq (cheaper query) over after (rowid subquery)
    if (sinceSeq) {
      const messages = await db.listMessagesSinceSeq(
        roomId,
        Number(sinceSeq),
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
  .post('/:id/messages', requireAuth, rateLimitByKey(60, 60_000), async c => {
    const keyId = c.get('keyId')
    const roomId = c.req.param('id')
    const db = queries(c.env.DB)

    const room = await db.findRoom(roomId, keyId)
    if (!room) {
      return c.json({ error: 'room not found' }, 404)
    }

    const body = await c.req.json<{
      sender?: string
      content?: string
      sender_type?: string
      color?: string
      attachment_ids?: string[]
    }>()
    if (!body.sender || !body.content) {
      return c.json({ error: 'sender and content are required' }, 400)
    }

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
  })

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
  .post('/:id/logs', requireAuth, rateLimitByKey(60, 60_000), async c => {
    const keyId = c.get('keyId')
    const roomId = c.req.param('id')
    const db = queries(c.env.DB)

    const room = await db.findRoom(roomId, keyId)
    if (!room) {
      return c.json({ error: 'room not found' }, 404)
    }

    const body = await c.req.json<{
      sender?: string
      content?: string
      color?: string
      message_id?: string
    }>()
    if (!body.sender || !body.content) {
      return c.json({ error: 'sender and content are required' }, 400)
    }

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
  })

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
  .post('/:id/team-info', requireAuth, async c => {
    const keyId = c.get('keyId')
    const roomId = c.req.param('id')
    const db = queries(c.env.DB)

    const room = await db.findRoom(roomId, keyId)
    if (!room) {
      return c.json({ error: 'room not found' }, 404)
    }

    const body = await c.req.json<TeamInfo>()

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
