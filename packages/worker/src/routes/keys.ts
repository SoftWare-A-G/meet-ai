import { Hono } from 'hono'
import { queries } from '../db/queries'
import { generateKey, hashKey, keyPrefix } from '../lib/keys'
import { rateLimitByIp } from '../middleware/rate-limit'
import type { AppEnv } from '../lib/types'

export const keysRoute = new Hono<AppEnv>()

  // 5 key generations per minute per IP
  .post('/', rateLimitByIp(5, 60_000), async c => {
    const key = generateKey()
    const hash = await hashKey(key)
    const prefix = keyPrefix(key)
    const id = crypto.randomUUID()

    const db = queries(c.env.DB)
    await db.insertKey(id, hash, prefix)

    return c.json({ key, prefix }, 201)
  })
