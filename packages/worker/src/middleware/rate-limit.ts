import { createMiddleware } from 'hono/factory'
import type { AppEnv } from '../lib/types'

type RateLimitEntry = { count: number; resetAt: number }

const keyStore = new Map<string, RateLimitEntry>()
const ipStore = new Map<string, RateLimitEntry>()

/** Clear all rate limit state — used in tests */
export function resetRateLimits() {
  keyStore.clear()
  ipStore.clear()
}

function checkLimit(
  store: Map<string, RateLimitEntry>,
  key: string,
  limit: number,
  windowMs: number
): boolean {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now >= entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (entry.count >= limit) {
    return false
  }

  entry.count++
  return true
}

export function rateLimitByKey(limit: number, windowMs: number) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const keyId = c.get('keyId')

    if (!checkLimit(keyStore, keyId, limit, windowMs)) {
      return c.json({ error: 'rate limit exceeded' }, 429)
    }

    await next()
  })
}

export function rateLimitByIp(limit: number, windowMs: number) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const ip =
      c.req.header('cf-connecting-ip') ||
      c.req.header('x-forwarded-for') ||
      'unknown'

    if (!checkLimit(ipStore, ip, limit, windowMs)) {
      return c.json({ error: 'rate limit exceeded' }, 429)
    }

    await next()
  })
}
