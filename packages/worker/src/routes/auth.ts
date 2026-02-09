import { Hono } from 'hono'
import type { AppEnv } from '../lib/types'
import { requireAuth } from '../middleware/auth'

export const authRoute = new Hono<AppEnv>()

// POST /api/auth/share — create a one-time share token (requires auth)
authRoute.post('/share', requireAuth, async (c) => {
  const keyId = c.get('keyId')

  // Extract the raw API key from the request (same logic as auth middleware)
  const header = c.req.header('Authorization')
  let rawKey: string | undefined
  if (header?.startsWith('Bearer ')) {
    rawKey = header.slice(7)
  } else {
    rawKey = c.req.query('token') ?? undefined
  }

  if (!rawKey) {
    return c.json({ error: 'Could not extract API key' }, 400)
  }

  const body = await c.req.json<{ room_id?: string }>().catch(() => ({} as { room_id?: string }))
  const roomId = body.room_id || null

  // Verify room exists and belongs to this key (when provided)
  if (roomId) {
    const room = await c.env.DB.prepare(
      'SELECT id FROM rooms WHERE id = ? AND key_id = ?'
    ).bind(roomId, keyId).first()

    if (!room) {
      return c.json({ error: 'room not found' }, 404)
    }
  }

  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

  await c.env.DB.prepare(
    'INSERT INTO share_tokens (token, key_id, room_id, api_key, expires_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(token, keyId, roomId, rawKey, expiresAt).run()

  const url = new URL(c.req.url)
  const shareUrl = `${url.protocol}//${url.host}/auth/${token}`

  return c.json({ token, url: shareUrl }, 201)
})

// GET /api/auth/claim/:token — claim a share token (no auth required)
authRoute.get('/claim/:token', async (c) => {
  const token = c.req.param('token')

  const row = await c.env.DB.prepare(
    'SELECT token, key_id, room_id, api_key, expires_at, used FROM share_tokens WHERE token = ?'
  ).bind(token).first<{ token: string; key_id: string; room_id: string | null; api_key: string; expires_at: string; used: number }>()

  if (!row || row.used === 1) {
    return c.json({ error: 'Invalid or expired link' }, 404)
  }

  if (new Date(row.expires_at) < new Date()) {
    return c.json({ error: 'Invalid or expired link' }, 404)
  }

  // Mark as used
  await c.env.DB.prepare(
    'UPDATE share_tokens SET used = 1 WHERE token = ?'
  ).bind(token).run()

  return c.json({ api_key: row.api_key, room_id: row.room_id })
})
