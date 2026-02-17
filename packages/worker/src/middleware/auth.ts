import type { Context } from 'hono'
import { createMiddleware } from 'hono/factory'
import { hashKey } from '../lib/keys'
import type { AppEnv } from '../lib/types'

export function extractToken(c: Context<AppEnv>): string | undefined {
  const header = c.req.header('Authorization')
  if (header?.startsWith('Bearer ')) {
    return header.slice(7)
  }
  return c.req.query('token') ?? undefined
}

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  // 1. Check Authorization header, fall back to query param
  const token = extractToken(c)

  if (!token) {
    return c.json({ error: 'Missing API key' }, 401)
  }

  // 2. Hash the key and look it up in D1
  const keyHash = await hashKey(token)
  const row = await c.env.DB.prepare(
    'SELECT id, key_hash, key_prefix, created_at, last_used FROM api_keys WHERE key_hash = ?'
  ).bind(keyHash).first<{ id: string }>()

  if (!row) {
    return c.json({ error: 'Invalid API key' }, 401)
  }

  // 3. Set keyId for downstream handlers
  c.set('keyId', row.id)

  // 4. Non-blocking last_used update
  c.executionCtx.waitUntil(
    c.env.DB.prepare(
      'UPDATE api_keys SET last_used = datetime("now") WHERE id = ?'
    ).bind(row.id).run()
  )

  await next()
})
