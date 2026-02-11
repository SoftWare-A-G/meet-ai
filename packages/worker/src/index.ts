import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { AppEnv } from './lib/types'
import { authRoute } from './routes/auth'
import { keysRoute } from './routes/keys'
import { roomsRoute } from './routes/rooms'
import { wsRoute } from './routes/ws'
import { lobbyRoute } from './routes/lobby'
import { pagesRoute } from './routes/pages'

export { ChatRoom } from './durable-objects/chat-room'
export { Lobby } from './durable-objects/lobby'

const app = new Hono<AppEnv>()

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
app.route('/', pagesRoute)

// Auth landing page — claims a share token and redirects to chat
app.get('/auth/:token', async (c) => {
  const token = c.req.param('token')
  return c.redirect(`/chat?token=${encodeURIComponent(token)}`, 302)
})

// Serve chat.html for /chat and /chat/ (PWA start_url)
app.get('/chat', async (c) => {
  const url = new URL(c.req.url)
  url.pathname = '/chat.html'
  return c.env.ASSETS.fetch(url.toString())
})

// Serve chat.html for /chat/:roomId paths (SPA routing)
app.get('/chat/:roomId', async (c) => {
  const url = new URL(c.req.url)
  url.pathname = '/chat.html'
  return c.env.ASSETS.fetch(url.toString())
})

export default app
