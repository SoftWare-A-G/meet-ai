import { Hono } from 'hono'
import { generateKey, hashKey, keyPrefix } from '../lib/keys'
import { queries } from '../db/queries'
import type { AppEnv } from '../lib/types'
import { rateLimitByIp } from '../middleware/rate-limit'

export const keysRoute = new Hono<AppEnv>()

// 5 key generations per minute per IP
keysRoute.post('/', rateLimitByIp(5, 60_000), async (c) => {
  const key = generateKey()
  const hash = await hashKey(key)
  const prefix = keyPrefix(key)
  const id = crypto.randomUUID()

  const db = queries(c.env.DB)
  await db.insertKey(id, hash, prefix)

  return c.json({ key, prefix }, 201)
})
