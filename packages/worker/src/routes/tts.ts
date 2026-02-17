import type { Context } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import { requireAuth, extractToken } from '../middleware/auth'
import type { AppEnv } from '../lib/types'

const VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb'
const MODEL_ID = 'eleven_multilingual_v2'
const CACHE_TTL = 604800 // 7 days in seconds
const API_CALL_LIMIT = 10
const API_CALL_WINDOW_MS = 60_000

const ttsSchema = z.object({
  text: z.string().min(1).max(5000),
})

// Separate rate limit store for TTS API calls only (not cache hits)
const ttsApiCallStore = new Map<string, { count: number; resetAt: number }>()

function checkTtsApiLimit(keyId: string): boolean {
  const now = Date.now()
  const entry = ttsApiCallStore.get(keyId)

  if (!entry || now >= entry.resetAt) {
    ttsApiCallStore.set(keyId, { count: 1, resetAt: now + API_CALL_WINDOW_MS })
    return true
  }

  if (entry.count >= API_CALL_LIMIT) return false
  entry.count++
  return true
}

function isVoiceAuthorized(c: Context<AppEnv>): boolean {
  return extractToken(c) === c.env.VOICE_API_AVAILABLE_FOR
}

async function hashText(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export const ttsRoute = new Hono<AppEnv>()

  // GET /api/tts/status — check if TTS is available for this key
  .get('/status', requireAuth, c =>
    c.json({ available: isVoiceAuthorized(c) })
  )

  // POST /api/tts — generate or return cached TTS audio
  .post('/', requireAuth, zValidator('json', ttsSchema), async c => {
    if (!isVoiceAuthorized(c)) {
      return c.json({ error: 'Voice API not available for this key' }, 403)
    }

    const { text } = c.req.valid('json')
    const textHash = await hashText(text)
    const cacheKey = `tts:${textHash}`

    // Check KV cache — no rate limit for cached responses
    const cached = await c.env.UPLOADS.get(cacheKey, { type: 'arrayBuffer' })
    if (cached) {
      return new Response(cached, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'private, max-age=86400',
          'X-TTS-Cache': 'hit',
        },
      })
    }

    // Rate limit only actual ElevenLabs API calls
    if (!checkTtsApiLimit(c.get('keyId'))) {
      return c.json({ error: 'rate limit exceeded' }, 429)
    }

    // Call ElevenLabs REST API
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
      method: 'POST',
      headers: {
        'xi-api-key': c.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: MODEL_ID,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('ElevenLabs API error:', response.status, errorText)
      return c.json({ error: 'TTS generation failed' }, 502)
    }

    const audioBytes = await response.arrayBuffer()

    // Store in KV with 7-day TTL (non-blocking)
    c.executionCtx.waitUntil(
      c.env.UPLOADS.put(cacheKey, audioBytes, { expirationTtl: CACHE_TTL })
    )

    return new Response(audioBytes, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'private, max-age=86400',
        'X-TTS-Cache': 'miss',
      },
    })
  })
