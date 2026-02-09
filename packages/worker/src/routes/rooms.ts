import { Hono } from 'hono'
import type { AppEnv } from '../lib/types'
import { requireAuth } from '../middleware/auth'
import { rateLimitByKey } from '../middleware/rate-limit'
import { queries } from '../db/queries'

export const roomsRoute = new Hono<AppEnv>()

// GET /api/rooms — list rooms scoped to this API key
roomsRoute.get('/', requireAuth, async (c) => {
  const keyId = c.get('keyId')
  const db = queries(c.env.DB)
  const rooms = await db.listRooms(keyId)
  return c.json(rooms)
})

// POST /api/rooms — create a room
roomsRoute.post('/', requireAuth, async (c) => {
  const keyId = c.get('keyId')
  const body = await c.req.json<{ name?: string }>()
  if (!body.name) {
    return c.json({ error: 'name is required' }, 400)
  }

  const id = crypto.randomUUID()
  const db = queries(c.env.DB)
  await db.insertRoom(id, keyId, body.name)

  return c.json({ id, name: body.name }, 201)
})

// GET /api/rooms/:id/messages — get message history
roomsRoute.get('/:id/messages', requireAuth, async (c) => {
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
    const messages = await db.listMessagesSinceSeq(roomId, Number(sinceSeq), exclude || undefined, senderType || undefined)
    return c.json(messages)
  }

  const messages = await db.listMessages(roomId, after || undefined, exclude || undefined, senderType || undefined)
  return c.json(messages)
})

// POST /api/rooms/:id/messages — send a message (60/min per key)
roomsRoute.post('/:id/messages', requireAuth, rateLimitByKey(60, 60_000), async (c) => {
  const keyId = c.get('keyId')
  const roomId = c.req.param('id')
  const db = queries(c.env.DB)

  const room = await db.findRoom(roomId, keyId)
  if (!room) {
    return c.json({ error: 'room not found' }, 404)
  }

  const body = await c.req.json<{ sender?: string; content?: string; sender_type?: string; color?: string }>()
  if (!body.sender || !body.content) {
    return c.json({ error: 'sender and content are required' }, 400)
  }

  const senderType = body.sender_type === 'agent' ? 'agent' : 'human'
  const color = body.color || null
  const id = crypto.randomUUID()
  const seq = await db.insertMessage(id, roomId, body.sender, body.content, senderType, color ?? undefined)

  const message = { id, room_id: roomId, sender: body.sender, sender_type: senderType, content: body.content, color, seq }

  // Broadcast via Durable Object
  const doId = c.env.CHAT_ROOM.idFromName(`${keyId}:${roomId}`)
  const stub = c.env.CHAT_ROOM.get(doId)
  c.executionCtx.waitUntil(
    stub.fetch(new Request('http://internal/broadcast', {
      method: 'POST',
      body: JSON.stringify(message),
    }))
  )

  return c.json(message, 201)
})
