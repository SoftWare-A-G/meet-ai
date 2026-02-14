import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { queries } from './db/queries'
import { authRoute } from './routes/auth'
import { keysRoute } from './routes/keys'
import { lobbyRoute } from './routes/lobby'
import { pagesRoute } from './routes/pages'
import { roomsRoute } from './routes/rooms'
import { uploadsRoute } from './routes/uploads'
import { wsRoute } from './routes/ws'
import type { AppEnv } from './lib/types'

export { ChatRoom } from './durable-objects/chat-room'
export { Lobby } from './durable-objects/lobby'

export const app = new Hono<AppEnv>()

app.onError((err, c) => {
  if (err instanceof SyntaxError) {
    return c.json({ error: 'Invalid JSON' }, 400)
  }
  console.error('Unhandled error:', err)
  return c.json({ error: 'Internal server error' }, 500)
})

app.use('*', cors())

app.route('/api/auth', authRoute)
app.route('/api/keys', keysRoute)
app.route('/api/rooms', roomsRoute)
app.route('/api/rooms', wsRoute)
app.route('/api/lobby', lobbyRoute)
app.route('/api/rooms', uploadsRoute)
app.route('/api', uploadsRoute)
app.route('/', pagesRoute)

// Auth landing page — claims a share token and redirects to chat
app.get('/auth/:token', async c => {
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
