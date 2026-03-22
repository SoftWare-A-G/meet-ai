import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { queries } from '../db/queries'
import { requireAuth } from '../middleware/auth'
import { canvasMutationsSchema } from '../schemas/canvas'
import { createDOClient } from '../lib/do-client'
import type { CanvasRoomApp } from '../durable-objects/canvas-room'
import type { AppEnv } from '../lib/types'

export const canvasRoute = new Hono<AppEnv>()

  // POST /api/rooms/:id/canvas — ensure a canvas exists for the room
  .post('/:id/canvas', requireAuth, async c => {
    const keyId = c.get('keyId')
    const roomId = c.req.param('id')
    const db = queries(c.env.DB)

    const room = await db.findRoom(roomId, keyId)
    if (!room) {
      return c.json({ error: 'room not found' }, 404)
    }

    // Check if canvas already exists
    let canvas = await db.findCanvasByRoom(roomId, keyId)
    if (canvas) {
      await db.touchCanvas(canvas.id, keyId)
      return c.json(canvas)
    }

    // Create new canvas
    const id = crypto.randomUUID()
    canvas = await db.createCanvas(id, roomId, keyId)
    return c.json(canvas, 201)
  })

  // GET /api/rooms/:id/canvas — fetch canvas metadata + ws_url
  .get('/:id/canvas', requireAuth, async c => {
    const keyId = c.get('keyId')
    const roomId = c.req.param('id')
    const db = queries(c.env.DB)

    const room = await db.findRoom(roomId, keyId)
    if (!room) {
      return c.json({ error: 'room not found' }, 404)
    }

    const canvas = await db.findCanvasByRoom(roomId, keyId)
    if (!canvas) {
      return c.json({ error: 'canvas not found' }, 404)
    }

    await db.touchCanvas(canvas.id, keyId)

    // Build the WebSocket URL for the canvas DO (auth via WS ticket query param)
    const protocol = c.req.url.startsWith('https') ? 'wss' : 'ws'
    const host = new URL(c.req.url).host
    const wsUrl = `${protocol}://${host}/api/rooms/${roomId}/canvas/ws`

    return c.json({
      ...canvas,
      ws_url: wsUrl,
      snapshot_url: `/api/rooms/${roomId}/canvas/snapshot`,
    })
  })

  // GET /api/rooms/:id/canvas/ws — WebSocket upgrade, forwarded to CanvasRoom DO
  .get('/:id/canvas/ws', requireAuth, async c => {
    const keyId = c.get('keyId')
    const roomId = c.req.param('id')
    const db = queries(c.env.DB)

    const room = await db.findRoom(roomId, keyId)
    if (!room) {
      return c.json({ error: 'room not found' }, 404)
    }

    const canvas = await db.findCanvasByRoom(roomId, keyId)
    if (!canvas) {
      return c.json({ error: 'canvas not found' }, 404)
    }

    const upgradeHeader = c.req.header('Upgrade')
    if (upgradeHeader !== 'websocket') {
      return c.json({ error: 'expected websocket upgrade' }, 426)
    }

    // Forward to CanvasRoom DO — preserve query string (sessionId, storeId from tldraw)
    const doId = c.env.CANVAS_ROOM.idFromName(`${keyId}:${canvas.id}`)
    const stub = c.env.CANVAS_ROOM.get(doId)
    const originalUrl = new URL(c.req.url)
    const doUrl = `http://internal/ws${originalUrl.search}`
    const headers = new Headers(c.req.raw.headers)
    headers.set('X-Room-Id', roomId)
    return stub.fetch(new Request(doUrl, { headers }))
  })

  // GET /api/rooms/:id/canvas/snapshot — readonly snapshot
  .get('/:id/canvas/snapshot', requireAuth, async c => {
    const keyId = c.get('keyId')
    const roomId = c.req.param('id')
    const db = queries(c.env.DB)

    const room = await db.findRoom(roomId, keyId)
    if (!room) {
      return c.json({ error: 'room not found' }, 404)
    }

    const canvas = await db.findCanvasByRoom(roomId, keyId)
    if (!canvas) {
      return c.json({ error: 'canvas not found' }, 404)
    }

    // Forward to CanvasRoom DO via typed client
    const doId = c.env.CANVAS_ROOM.idFromName(`${keyId}:${canvas.id}`)
    const stub = c.env.CANVAS_ROOM.get(doId)
    const client = createDOClient<CanvasRoomApp>(stub)
    const res = await client.snapshot.$get({}, { headers: { 'X-Room-Id': roomId } })
    const snapshot = await res.json()

    return c.json({ canvas_id: canvas.id, room_id: roomId, snapshot })
  })

  // POST /api/rooms/:id/canvas/mutations — apply server-side mutations
  .post('/:id/canvas/mutations', requireAuth, zValidator('json', canvasMutationsSchema), async c => {
    const keyId = c.get('keyId')
    const roomId = c.req.param('id')
    const db = queries(c.env.DB)

    const room = await db.findRoom(roomId, keyId)
    if (!room) {
      return c.json({ error: 'room not found' }, 404)
    }

    const canvas = await db.findCanvasByRoom(roomId, keyId)
    if (!canvas) {
      return c.json({ error: 'canvas not found' }, 404)
    }

    // schema transform already ran validateCanvasMutationPuts — body.puts is TLRecord[] | undefined
    const body = c.req.valid('json')

    // Forward to CanvasRoom DO via typed client
    const doId = c.env.CANVAS_ROOM.idFromName(`${keyId}:${canvas.id}`)
    const stub = c.env.CANVAS_ROOM.get(doId)
    const client = createDOClient<CanvasRoomApp>(stub)
    const res = await client.mutations.$post({ json: body }, { headers: { 'X-Room-Id': roomId } })

    if (!res.ok) {
      return c.json({ error: 'mutation failed' }, 500)
    }

    await db.touchCanvas(canvas.id, keyId)

    return c.json({
      canvas_id: canvas.id,
      room_id: roomId,
      ok: true,
    })
  })
