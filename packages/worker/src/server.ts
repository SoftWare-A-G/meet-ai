/**
 * Custom Worker entrypoint that routes between Hono API and TanStack Start SSR.
 *
 * - /api/*  -> Hono (existing API)
 * - /auth/* -> Hono (share token redirect)
 * - /*      -> TanStack Start (SSR pages)
 *
 * wrangler.toml `main` should point to this file.
 */

import type { AppEnv } from './lib/types'

// Lazy-load Hono app to avoid contaminating JSX runtime during SSR
async function getHonoApp() {
  const { app } = await import('./index')
  const { queries: q } = await import('./db/queries')
  return { app, queries: q }
}

// Re-export Durable Objects so wrangler can discover them
export { ChatRoom } from './durable-objects/chat-room'
export { Lobby } from './durable-objects/lobby'

// Lazily import the TanStack Start server entry (resolved by vite virtual module)
async function getStartHandler() {
  const mod = await import('@tanstack/react-start/server-entry')
  return mod.default
}

const serverHandler = {
  async fetch(request: Request, env: AppEnv['Bindings'], ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    // Route /api/* and /auth/* to Hono
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) {
      const { app } = await getHonoApp()
      return app.fetch(request, env, ctx)
    }

    // Serve landing page as markdown for AI/search crawlers
    if (url.pathname === '/' && request.headers.get('Accept')?.includes('text/markdown')) {
      const { landingMarkdown } = await import('./landing-md')
      return new Response(landingMarkdown, {
        status: 200,
        headers: {
          'Content-Type': 'text/markdown; charset=UTF-8',
          'X-Markdown-Tokens': '685',
          'Content-Signal': 'ai-train=yes, search=yes, ai-input=yes',
        },
      })
    }

    // Everything else goes to TanStack Start SSR
    try {
      const startHandler = await getStartHandler()
      return await startHandler.fetch(request)
    } catch (error) {
      console.error('TanStack Start SSR error:', error)
      // Fallback to Hono pages if TanStack Start fails
      const { app } = await getHonoApp()
      return app.fetch(request, env, ctx)
    }
  },

  async scheduled(_event: ScheduledEvent, env: AppEnv['Bindings'], _ctx: ExecutionContext) {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString()
      .replace('T', ' ')
      .slice(0, 19)
    const { queries } = await getHonoApp()
    await queries(env.DB).deleteOldLogs(cutoff)
  },
}

export default serverHandler
