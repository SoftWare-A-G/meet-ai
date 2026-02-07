import { describe, it, expect, beforeEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'
import { applyD1Migrations } from 'cloudflare:test'
import { resetRateLimits } from '../src/middleware/rate-limit'

beforeEach(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
  resetRateLimits()
})

/** Generate a key via API, return the raw key string */
async function createKey(): Promise<string> {
  const res = await SELF.fetch('http://localhost/api/keys', { method: 'POST' })
  const body = await res.json() as { key: string; prefix: string }
  return body.key
}

async function createRoom(key: string, name: string): Promise<string> {
  const res = await SELF.fetch('http://localhost/api/rooms', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  const room = await res.json() as { id: string }
  return room.id
}

async function sendMessage(key: string, roomId: string, sender: string, content: string) {
  return SELF.fetch(`http://localhost/api/rooms/${roomId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sender, content }),
  })
}

describe('API Keys', () => {
  it('POST /api/keys creates a key with mai_ prefix', async () => {
    const res = await SELF.fetch('http://localhost/api/keys', { method: 'POST' })
    expect(res.status).toBe(201)
    const body = await res.json() as { key: string; prefix: string }
    expect(body.key).toMatch(/^mai_/)
    expect(body.key).toHaveLength(28) // mai_ (4) + 24 chars
    expect(body.prefix).toBe(body.key.slice(0, 8))
  })

  it('generates unique keys', async () => {
    const res1 = await SELF.fetch('http://localhost/api/keys', { method: 'POST' })
    const k1 = await res1.json() as { key: string }

    const res2 = await SELF.fetch('http://localhost/api/keys', { method: 'POST' })
    const k2 = await res2.json() as { key: string }

    expect(k1.key).toBeTruthy()
    expect(k2.key).toBeTruthy()
    expect(k1.key).not.toBe(k2.key)
  })
})

describe('Auth Middleware', () => {
  it('rejects requests without API key', async () => {
    const res = await SELF.fetch('http://localhost/api/rooms')
    expect(res.status).toBe(401)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Missing API key')
  })

  it('rejects requests with invalid API key', async () => {
    const res = await SELF.fetch('http://localhost/api/rooms', {
      headers: { Authorization: 'Bearer mai_invalidkey1234567890ab' },
    })
    expect(res.status).toBe(401)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Invalid API key')
  })

  it('accepts valid Bearer token', async () => {
    const key = await createKey()
    const res = await SELF.fetch('http://localhost/api/rooms', {
      headers: { Authorization: `Bearer ${key}` },
    })
    expect(res.status).toBe(200)
  })

  it('accepts token as query param', async () => {
    const key = await createKey()
    const res = await SELF.fetch(`http://localhost/api/rooms?token=${encodeURIComponent(key)}`)
    expect(res.status).toBe(200)
  })
})

describe('Rooms', () => {
  it('GET /api/rooms returns empty list initially', async () => {
    const key = await createKey()
    const res = await SELF.fetch('http://localhost/api/rooms', {
      headers: { Authorization: `Bearer ${key}` },
    })
    expect(res.status).toBe(200)
    const rooms = await res.json()
    expect(rooms).toEqual([])
  })

  it('POST /api/rooms creates a room', async () => {
    const key = await createKey()
    const res = await SELF.fetch('http://localhost/api/rooms', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'test-room' }),
    })
    expect(res.status).toBe(201)
    const room = await res.json() as { id: string; name: string }
    expect(room.name).toBe('test-room')
    expect(room.id).toBeTruthy()
  })

  it('POST /api/rooms requires name', async () => {
    const key = await createKey()
    const res = await SELF.fetch('http://localhost/api/rooms', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })

  it('rooms are scoped to API key (tenant isolation)', async () => {
    const key1 = await createKey()
    const key2 = await createKey()

    // Key 1 creates a room
    const createRes = await SELF.fetch('http://localhost/api/rooms', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'key1-room' }),
    })
    expect(createRes.status).toBe(201)

    // Key 1 sees the room
    const res1 = await SELF.fetch('http://localhost/api/rooms', {
      headers: { Authorization: `Bearer ${key1}` },
    })
    const rooms1 = await res1.json() as { name: string }[]
    expect(rooms1).toHaveLength(1)
    expect(rooms1[0].name).toBe('key1-room')

    // Key 2 sees no rooms
    const res2 = await SELF.fetch('http://localhost/api/rooms', {
      headers: { Authorization: `Bearer ${key2}` },
    })
    const rooms2 = await res2.json()
    expect(rooms2).toEqual([])
  })
})

describe('Messages', () => {
  it('GET /api/rooms/:id/messages returns empty list', async () => {
    const key = await createKey()
    const roomId = await createRoom(key, 'msg-room')

    const res = await SELF.fetch(`http://localhost/api/rooms/${roomId}/messages`, {
      headers: { Authorization: `Bearer ${key}` },
    })
    expect(res.status).toBe(200)
    const messages = await res.json()
    expect(messages).toEqual([])
  })

  it('POST /api/rooms/:id/messages sends a message', async () => {
    const key = await createKey()
    const roomId = await createRoom(key, 'msg-room')

    const res = await sendMessage(key, roomId, 'alice', 'hello world')
    expect(res.status).toBe(201)
    const msg = await res.json() as { id: string; sender: string; content: string }
    expect(msg.sender).toBe('alice')
    expect(msg.content).toBe('hello world')
  })

  it('requires sender and content', async () => {
    const key = await createKey()
    const roomId = await createRoom(key, 'msg-room')

    const res = await SELF.fetch(`http://localhost/api/rooms/${roomId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender: 'alice' }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 404 for non-existent room', async () => {
    const key = await createKey()
    const res = await SELF.fetch('http://localhost/api/rooms/nonexistent/messages', {
      headers: { Authorization: `Bearer ${key}` },
    })
    expect(res.status).toBe(404)
  })

  it('messages are scoped — other key cannot access room', async () => {
    const key1 = await createKey()
    const key2 = await createKey()
    const roomId = await createRoom(key1, 'secret-room')

    await sendMessage(key1, roomId, 'alice', 'secret message')

    // Key2 cannot read key1's room
    const res = await SELF.fetch(`http://localhost/api/rooms/${roomId}/messages`, {
      headers: { Authorization: `Bearer ${key2}` },
    })
    expect(res.status).toBe(404)
  })

  it('supports after parameter for polling', async () => {
    const key = await createKey()
    const roomId = await createRoom(key, 'poll-room')

    // Send 3 messages
    const ids: string[] = []
    for (const content of ['msg1', 'msg2', 'msg3']) {
      const res = await sendMessage(key, roomId, 'alice', content)
      const msg = await res.json() as { id: string }
      ids.push(msg.id)
    }

    // Poll after first message
    const res = await SELF.fetch(
      `http://localhost/api/rooms/${roomId}/messages?after=${ids[0]}`,
      { headers: { Authorization: `Bearer ${key}` } }
    )
    expect(res.status).toBe(200)
    const messages = await res.json() as { content: string }[]
    expect(messages).toHaveLength(2)
    expect(messages[0].content).toBe('msg2')
    expect(messages[1].content).toBe('msg3')
  })
})
