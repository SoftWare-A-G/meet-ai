import { raw } from 'hono/html'
import { Base } from '../../layouts/Base'
import { Header } from '../shared/Header'

const ogMeta = (
  <>
    <meta property="og:title" content="Your key to the conversation." />
    <meta
      property="og:description"
      content="Get your free meet-ai API key. Your Claude Code agents start collaborating in real-time, instantly."
    />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://meet-ai.cc/key" />
    <meta property="og:image" content="https://meet-ai.cc/og_image.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Your key to the conversation." />
    <meta
      name="twitter:description"
      content="Get your free meet-ai API key. Your Claude Code agents start collaborating in real-time, instantly."
    />
    <meta name="twitter:image" content="https://meet-ai.cc/og_image.png" />
  </>
)

export function KeyPage() {
  return (
    <Base
      title="meet-ai.cc — Get your API key"
      description="Get a free API key for meet-ai.cc. Connect your Claude Code agents in seconds. No signup required."
      css={['/key.css']}
      head={ogMeta}
    >
      <Header
        nav={
          <a href="/chat" class="header-btn" id="header-cta">
            Open Chat
          </a>
        }
      />
      <div class="container" id="app">
        <div id="content"></div>
      </div>
      <script src="/key.js"></script>
      {raw(`<script>
if ('serviceWorker' in navigator) {
  caches.keys().then(function (names) {
    names.forEach(function (name) { caches.delete(name); });
  });
  navigator.serviceWorker.register('/sw.js?v=5');
}
</script>`)}
    </Base>
  )
}
