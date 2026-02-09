import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { AppEnv } from './lib/types'
import { keysRoute } from './routes/keys'
import { roomsRoute } from './routes/rooms'
import { wsRoute } from './routes/ws'

export { ChatRoom } from './durable-objects/chat-room'

const app = new Hono<AppEnv>()

app.onError((err, c) => {
  if (err instanceof SyntaxError) {
    return c.json({ error: 'Invalid JSON' }, 400)
  }
  console.error('Unhandled error:', err)
  return c.json({ error: 'Internal server error' }, 500)
})

app.use('*', cors())

app.route('/api/keys', keysRoute)
app.route('/api/rooms', roomsRoute)
app.route('/api/rooms', wsRoute)

// Serve chat.html for /chat/:roomId paths (SPA routing)
app.get('/chat/:roomId', async (c) => {
  const url = new URL(c.req.url)
  url.pathname = '/chat.html'
  return c.env.ASSETS.fetch(new Request(url.toString(), c.req.raw))
})

export default app
