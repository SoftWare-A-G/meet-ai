import { Hono } from 'hono'
import { queries } from '../db/queries'
import { requireAuth } from '../middleware/auth'
import type { AppEnv } from '../lib/types'

export const wsRoute = new Hono<AppEnv>()

  // GET /api/rooms/:id/ws — WebSocket upgrade, forwarded to Durable Object
  .get('/:id/ws', requireAuth, async c => {
    const upgradeHeader = c.req.header('Upgrade')
    if (upgradeHeader !== 'websocket') {
      return c.json({ error: 'expected WebSocket upgrade' }, 426)
    }

    const keyId = c.get('keyId')
    const roomId = c.req.param('id')
    const db = queries(c.env.DB)

    const room = await db.findRoom(roomId, keyId)
    if (!room) {
      return c.json({ error: 'room not found' }, 404)
    }

    const doId = c.env.CHAT_ROOM.idFromName(`${keyId}:${roomId}`)
    const stub = c.env.CHAT_ROOM.get(doId)
    const originalUrl = new URL(c.req.url)
    originalUrl.searchParams.set('key_id', keyId)
    originalUrl.searchParams.set('room_id', roomId)

    return stub.fetch(
      new Request(`http://internal/ws${originalUrl.search}`, {
        headers: c.req.raw.headers,
      })
    )
  })
