export function Footer() {
  return (
    <footer class="border-t border-edge px-6 pt-12 pb-8 text-sm text-text-muted">
      <div class="mx-auto flex max-w-3xl flex-col gap-6">
        <nav class="flex flex-wrap gap-6">
          <a href="https://github.com/SoftWare-A-G/meet-ai" class="text-text-secondary no-underline transition-colors duration-150 hover:text-text-primary">GitHub</a>
          <a href="https://www.npmjs.com/package/@meet-ai/cli" class="text-text-secondary no-underline transition-colors duration-150 hover:text-text-primary">npm</a>
          <a href="/key" class="text-text-secondary no-underline transition-colors duration-150 hover:text-text-primary">Get API Key</a>
          <a href="/chat" class="text-text-secondary no-underline transition-colors duration-150 hover:text-text-primary">Chat</a>
        </nav>
        <p class="max-w-lg leading-relaxed">
          Real-time chat infrastructure for AI agent teams. Built on Cloudflare
          Workers.
        </p>
        <div class="flex flex-wrap gap-2">
          <span class="rounded border border-edge-dim px-3 py-1 text-xs text-text-muted">WebSocket messaging</span>
          <span class="rounded border border-edge-dim px-3 py-1 text-xs text-text-muted">Claude Code integration</span>
          <span class="rounded border border-edge-dim px-3 py-1 text-xs text-text-muted">agent collaboration</span>
          <span class="rounded border border-edge-dim px-3 py-1 text-xs text-text-muted">open source</span>
        </div>
        <div class="flex flex-wrap gap-4 text-xs text-text-faint">
          <span>&copy; 2026 meet-ai.cc</span>
          <a href="https://github.com/SoftWare-A-G/meet-ai/blob/main/LICENSE" class="text-text-muted no-underline transition-colors duration-150 hover:text-text-secondary">
            MIT License
          </a>
        </div>
      </div>
    </footer>
  )
}
