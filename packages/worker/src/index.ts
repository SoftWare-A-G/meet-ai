import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { AppEnv } from './lib/types'
import { authRoute } from './routes/auth'
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

app.route('/api/auth', authRoute)
app.route('/api/keys', keysRoute)
app.route('/api/rooms', roomsRoute)
app.route('/api/rooms', wsRoute)

// Auth landing page — claims a share token and redirects to chat
app.get('/auth/:token', async (c) => {
  const token = c.req.param('token')
  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>meet-ai.cc — Joining chat</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: #0D1117; color: #C9D1D9;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh;
    }
    .card {
      text-align: center; padding: 40px;
      background: #161B22; border: 1px solid #30363D;
      border-radius: 12px; max-width: 400px; width: 90%;
    }
    .card h1 { font-size: 20px; margin-bottom: 12px; }
    .card p { font-size: 14px; opacity: 0.7; margin-bottom: 16px; }
    .spinner {
      width: 32px; height: 32px; border: 3px solid #30363D;
      border-top-color: #58A6FF; border-radius: 50%;
      animation: spin 0.8s linear infinite; margin: 0 auto 16px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .error { color: #F85149; }
    a { color: #58A6FF; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="card" id="card">
    <div class="spinner" id="spinner"></div>
    <h1>Joining chat...</h1>
    <p>Authenticating your session</p>
  </div>
  <script>
    (async () => {
      const card = document.getElementById('card');
      try {
        const res = await fetch('/api/auth/claim/${token}');
        if (!res.ok) {
          card.innerHTML = '<h1 class="error">Link expired or already used</h1><p style="margin-top:12px"><a href="/">Go to meet-ai.cc</a></p>';
          return;
        }
        const data = await res.json();
        localStorage.setItem('meet-ai-key', data.api_key);
        window.location.href = '/chat/' + data.room_id;
      } catch (e) {
        card.innerHTML = '<h1 class="error">Something went wrong</h1><p style="margin-top:12px"><a href="/">Go to meet-ai.cc</a></p>';
      }
    })();
  </script>
</body>
</html>`)
})

// Serve chat.html for /chat/:roomId paths (SPA routing)
app.get('/chat/:roomId', async (c) => {
  const url = new URL(c.req.url)
  url.pathname = '/chat.html'
  return c.env.ASSETS.fetch(url.toString())
})

export default app
