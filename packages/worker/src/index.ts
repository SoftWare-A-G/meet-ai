import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { cors } from 'hono/cors'
import { queries } from './db/queries'
import { authRoute } from './routes/auth'
import { keysRoute } from './routes/keys'
import { lobbyRoute } from './routes/lobby'
import { roomsRoute } from './routes/rooms'
import { planReviewsRoute } from './routes/plan-reviews'
import { ttsRoute } from './routes/tts'
import { uploadsRoute } from './routes/uploads'
import { wsRoute } from './routes/ws'
import type { AppEnv } from './lib/types'

export { ChatRoom } from './durable-objects/chat-room'
export { Lobby } from './durable-objects/lobby'

export const app = new Hono<AppEnv>()
  .onError((err, c) => {
    if (err instanceof SyntaxError) {
      return c.json({ error: 'Invalid JSON' }, 400)
    }

    if (err instanceof HTTPException) {
      return c.json({ error: err.message }, err.status)
    }

    console.error('Unhandled error:', err)

    return c.json({ error: 'Internal server error' }, 500)
  })

  .use('*', cors())

  .route('/api/auth', authRoute)
  .route('/api/keys', keysRoute)
  .route('/api/rooms', roomsRoute)
  .route('/api/rooms', planReviewsRoute)
  .route('/api/rooms', wsRoute)
  .route('/api/lobby', lobbyRoute)
  .route('/api/rooms', uploadsRoute)
  .route('/api', uploadsRoute)
  .route('/api/tts', ttsRoute)

  // Auth landing page — claims a share token and redirects to chat
  .get('/auth/:token', async c => {
    const token = c.req.param('token')
    return c.redirect(`/chat?token=${encodeURIComponent(token)}`, 302)
  })

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: AppEnv['Bindings'], _ctx: ExecutionContext) {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString()
      .replace('T', ' ')
      .slice(0, 19)
    await queries(env.DB).deleteOldLogs(cutoff)
  },
}

export type AppType = typeof app
