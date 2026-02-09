import { Hono } from 'hono'
import type { AppEnv } from '../lib/types'
import { requireAuth } from '../middleware/auth'

export const lobbyRoute = new Hono<AppEnv>()

// GET /api/lobby/ws — WebSocket upgrade, forwarded to Lobby DO (one per key_id)
lobbyRoute.get('/ws', requireAuth, async (c) => {
  const upgradeHeader = c.req.header('Upgrade')
  if (upgradeHeader !== 'websocket') {
    return c.json({ error: 'expected WebSocket upgrade' }, 426)
  }

  const keyId = c.get('keyId')
  const doId = c.env.LOBBY.idFromName(keyId)
  const stub = c.env.LOBBY.get(doId)

  return stub.fetch(new Request('http://internal/ws', {
    headers: c.req.raw.headers,
  }))
})
