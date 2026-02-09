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
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
  <link rel="manifest" href="/site.webmanifest">
  <meta name="theme-color" content="#0a0a0a">
  <title>meet-ai.cc — Join chat</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: #0a0a0a; color: #e5e5e5;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; padding: 24px;
      -webkit-font-smoothing: antialiased;
    }
    .card {
      text-align: center; padding: 40px;
      background: #1a1a1a; border: 1px solid #2a2a2a;
      border-radius: 12px; max-width: 400px; width: 100%;
      display: flex; flex-direction: column; align-items: center; gap: 16px;
    }
    .card h1 { font-size: 20px; font-weight: 700; }
    .card p { font-size: 14px; color: #888; line-height: 1.5; }
    .btn {
      display: inline-flex; align-items: center; justify-content: center;
      gap: 8px; padding: 14px 32px; border: none; border-radius: 999px;
      background: #2563eb; color: #fff; cursor: pointer;
      font-size: 16px; font-family: inherit; font-weight: 600;
      text-decoration: none; transition: background 0.15s;
      width: 100%;
    }
    .btn:hover { background: #1d4ed8; }
    .btn:active { background: #1e40af; }
    .btn:disabled { opacity: 0.6; cursor: wait; }
    .btn .arrow { transition: transform 0.2s ease; }
    .btn:hover .arrow { transform: translateX(4px); }
    .btn-secondary {
      display: inline-flex; align-items: center; justify-content: center;
      padding: 12px 24px; border: 1px solid #2a2a2a; border-radius: 999px;
      background: transparent; color: #888; cursor: pointer;
      font-size: 14px; font-family: inherit; font-weight: 500;
      text-decoration: none; transition: background 0.15s, color 0.15s, border-color 0.15s;
      width: 100%;
    }
    .btn-secondary:hover { background: #222; color: #e5e5e5; border-color: #3a3a3a; }
    .spinner {
      width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #fff; border-radius: 50%;
      animation: spin 0.6s linear infinite; display: inline-block;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .error { color: #f87171; }
    .muted { font-size: 12px; color: #555; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .hidden { display: none; }
    .separator { width: 100%; border-top: 1px solid #2a2a2a; margin: 4px 0; }
  </style>
</head>
<body>
  <div class="card" id="card">
    <h1>Join the conversation</h1>
    <p>You've been invited to a meet-ai chat room. Tap the button below to connect.</p>
    <button class="btn" id="join-btn">Connect <span class="arrow">&rarr;</span></button>
    <div class="separator"></div>
    <button class="btn-secondary hidden" id="pwa-btn">Open in PWA</button>
    <p class="muted" id="pwa-hint"></p>
  </div>
  <script>
    var token = '${token}';
    var joinBtn = document.getElementById('join-btn');
    var pwaBtn = document.getElementById('pwa-btn');
    var pwaHint = document.getElementById('pwa-hint');
    var card = document.getElementById('card');

    // Detect standalone PWA mode
    var isStandalone = window.navigator.standalone === true
      || window.matchMedia('(display-mode: standalone)').matches;

    // If NOT in PWA, show option to copy link for PWA
    if (!isStandalone) {
      pwaBtn.classList.remove('hidden');
      pwaHint.textContent = 'If you have the PWA installed, open it and paste the login link there.';
      pwaBtn.addEventListener('click', function() {
        var url = window.location.href;
        navigator.clipboard.writeText(url).then(function() {
          pwaBtn.textContent = 'Copied! Now open your PWA';
          pwaBtn.style.color = '#22c55e';
          pwaBtn.style.borderColor = 'rgba(34,197,94,0.3)';
        }).catch(function() {
          // fallback
          var ta = document.createElement('textarea');
          ta.value = url;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          pwaBtn.textContent = 'Copied! Now open your PWA';
          pwaBtn.style.color = '#22c55e';
          pwaBtn.style.borderColor = 'rgba(34,197,94,0.3)';
        });
      });
    }

    joinBtn.addEventListener('click', async function() {
      joinBtn.disabled = true;
      joinBtn.innerHTML = '<span class="spinner"></span> Connecting...';
      try {
        var res = await fetch('/api/auth/claim/' + encodeURIComponent(token));
        if (!res.ok) {
          card.innerHTML = '<h1 class="error">Link expired or already used</h1><p style="margin-top:12px"><a href="/">Go to meet-ai.cc</a></p>';
          return;
        }
        var data = await res.json();
        localStorage.setItem('meet-ai-key', data.api_key);
        window.location.href = '/chat/' + data.room_id;
      } catch (e) {
        card.innerHTML = '<h1 class="error">Something went wrong</h1><p style="margin-top:12px"><a href="/">Go to meet-ai.cc</a></p>';
      }
    });
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
