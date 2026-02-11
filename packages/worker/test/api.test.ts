import { describe, it, expect, beforeEach } from 'vitest'
import { env, SELF, applyD1Migrations } from 'cloudflare:test'
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

async function sendMessage(key: string, roomId: string, sender: string, content: string, senderType?: string, color?: string) {
  return SELF.fetch(`http://localhost/api/rooms/${roomId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sender, content, ...(senderType && { sender_type: senderType }), ...(color && { color }) }),
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

  it('POST response includes sequential seq numbers', async () => {
    const key = await createKey()
    const roomId = await createRoom(key, 'seq-room')

    const res1 = await sendMessage(key, roomId, 'alice', 'first')
    const msg1 = await res1.json() as { seq: number }

    const res2 = await sendMessage(key, roomId, 'bob', 'second')
    const msg2 = await res2.json() as { seq: number }

    const res3 = await sendMessage(key, roomId, 'alice', 'third')
    const msg3 = await res3.json() as { seq: number }

    expect(msg1.seq).toBe(1)
    expect(msg2.seq).toBe(2)
    expect(msg3.seq).toBe(3)
  })

  it('GET messages includes seq field', async () => {
    const key = await createKey()
    const roomId = await createRoom(key, 'seq-list-room')

    await sendMessage(key, roomId, 'alice', 'one')
    await sendMessage(key, roomId, 'bob', 'two')

    const res = await SELF.fetch(`http://localhost/api/rooms/${roomId}/messages`, {
      headers: { Authorization: `Bearer ${key}` },
    })
    const messages = await res.json() as { content: string; seq: number }[]
    expect(messages).toHaveLength(2)
    expect(messages[0].seq).toBe(1)
    expect(messages[1].seq).toBe(2)
  })

  it('supports since_seq parameter', async () => {
    const key = await createKey()
    const roomId = await createRoom(key, 'since-seq-room')

    await sendMessage(key, roomId, 'alice', 'msg1')
    await sendMessage(key, roomId, 'bob', 'msg2')
    await sendMessage(key, roomId, 'alice', 'msg3')

    const res = await SELF.fetch(
      `http://localhost/api/rooms/${roomId}/messages?since_seq=1`,
      { headers: { Authorization: `Bearer ${key}` } }
    )
    const messages = await res.json() as { content: string; seq: number }[]
    expect(messages).toHaveLength(2)
    expect(messages[0].content).toBe('msg2')
    expect(messages[0].seq).toBe(2)
    expect(messages[1].content).toBe('msg3')
    expect(messages[1].seq).toBe(3)
  })

  it('supports exclude parameter on server side', async () => {
    const key = await createKey()
    const roomId = await createRoom(key, 'exclude-room')

    await sendMessage(key, roomId, 'alice', 'from alice')
    await sendMessage(key, roomId, 'bob', 'from bob')
    await sendMessage(key, roomId, 'alice', 'also alice')

    const res = await SELF.fetch(
      `http://localhost/api/rooms/${roomId}/messages?exclude=alice`,
      { headers: { Authorization: `Bearer ${key}` } }
    )
    const messages = await res.json() as { sender: string }[]
    expect(messages).toHaveLength(1)
    expect(messages[0].sender).toBe('bob')
  })

  it('since_seq and exclude work together', async () => {
    const key = await createKey()
    const roomId = await createRoom(key, 'combo-room')

    await sendMessage(key, roomId, 'alice', 'a1')
    await sendMessage(key, roomId, 'bob', 'b1')
    await sendMessage(key, roomId, 'alice', 'a2')
    await sendMessage(key, roomId, 'bob', 'b2')

    const res = await SELF.fetch(
      `http://localhost/api/rooms/${roomId}/messages?since_seq=1&exclude=alice`,
      { headers: { Authorization: `Bearer ${key}` } }
    )
    const messages = await res.json() as { sender: string; content: string; seq: number }[]
    expect(messages).toHaveLength(2)
    expect(messages[0].content).toBe('b1')
    expect(messages[1].content).toBe('b2')
  })

  it('after and exclude work together', async () => {
    const key = await createKey()
    const roomId = await createRoom(key, 'after-exclude-room')

    const res1 = await sendMessage(key, roomId, 'alice', 'a1')
    const msg1 = await res1.json() as { id: string }
    await sendMessage(key, roomId, 'bob', 'b1')
    await sendMessage(key, roomId, 'alice', 'a2')
    await sendMessage(key, roomId, 'bob', 'b2')

    const res = await SELF.fetch(
      `http://localhost/api/rooms/${roomId}/messages?after=${msg1.id}&exclude=alice`,
      { headers: { Authorization: `Bearer ${key}` } }
    )
    const messages = await res.json() as { sender: string; content: string }[]
    expect(messages).toHaveLength(2)
    expect(messages[0].content).toBe('b1')
    expect(messages[1].content).toBe('b2')
  })

  it('seq numbers are independent per room', async () => {
    const key = await createKey()
    const room1 = await createRoom(key, 'room-a')
    const room2 = await createRoom(key, 'room-b')

    const r1m1 = await sendMessage(key, room1, 'alice', 'room1-first')
    const r1m2 = await sendMessage(key, room1, 'alice', 'room1-second')
    const r2m1 = await sendMessage(key, room2, 'bob', 'room2-first')

    expect((await r1m1.json() as { seq: number }).seq).toBe(1)
    expect((await r1m2.json() as { seq: number }).seq).toBe(2)
    expect((await r2m1.json() as { seq: number }).seq).toBe(1)
  })

  it('POST message returns 404 for non-existent room', async () => {
    const key = await createKey()
    const res = await sendMessage(key, 'nonexistent', 'alice', 'hello')
    expect(res.status).toBe(404)
  })

  it('POST message rejects invalid JSON', async () => {
    const key = await createKey()
    const roomId = await createRoom(key, 'json-room')
    const res = await SELF.fetch(`http://localhost/api/rooms/${roomId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: 'not json',
    })
    expect(res.status).toBe(400)
  })

  it('sender_type defaults to human', async () => {
    const key = await createKey()
    const roomId = await createRoom(key, 'type-room')

    const res = await sendMessage(key, roomId, 'alice', 'hello')
    const msg = await res.json() as { sender_type: string }
    expect(msg.sender_type).toBe('human')

    const listRes = await SELF.fetch(`http://localhost/api/rooms/${roomId}/messages`, {
      headers: { Authorization: `Bearer ${key}` },
    })
    const messages = await listRes.json() as { sender_type: string }[]
    expect(messages[0].sender_type).toBe('human')
  })

  it('sender_type can be set to agent', async () => {
    const key = await createKey()
    const roomId = await createRoom(key, 'agent-room')

    const res = await sendMessage(key, roomId, 'bot', 'beep boop', 'agent')
    const msg = await res.json() as { sender_type: string }
    expect(msg.sender_type).toBe('agent')
  })

  it('sender_type rejects invalid values (falls back to human)', async () => {
    const key = await createKey()
    const roomId = await createRoom(key, 'invalid-type-room')

    const res = await sendMessage(key, roomId, 'alice', 'test', 'robot')
    const msg = await res.json() as { sender_type: string }
    expect(msg.sender_type).toBe('human')
  })

  it('supports sender_type filter on poll', async () => {
    const key = await createKey()
    const roomId = await createRoom(key, 'filter-room')

    await sendMessage(key, roomId, 'alice', 'from human')
    await sendMessage(key, roomId, 'bot', 'from agent', 'agent')
    await sendMessage(key, roomId, 'bob', 'also human')

    const res = await SELF.fetch(
      `http://localhost/api/rooms/${roomId}/messages?sender_type=human`,
      { headers: { Authorization: `Bearer ${key}` } }
    )
    const messages = await res.json() as { sender: string; sender_type: string }[]
    expect(messages).toHaveLength(2)
    expect(messages[0].sender).toBe('alice')
    expect(messages[1].sender).toBe('bob')
    expect(messages.every(m => m.sender_type === 'human')).toBe(true)
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

  it('color defaults to null when not provided', async () => {
    const key = await createKey()
    const roomId = await createRoom(key, 'color-default-room')

    const res = await sendMessage(key, roomId, 'alice', 'no color')
    const msg = await res.json() as { color: string | null }
    expect(msg.color).toBeNull()

    const listRes = await SELF.fetch(`http://localhost/api/rooms/${roomId}/messages`, {
      headers: { Authorization: `Bearer ${key}` },
    })
    const messages = await listRes.json() as { color: string | null }[]
    expect(messages[0].color).toBeNull()
  })

  it('color can be set to a named color', async () => {
    const key = await createKey()
    const roomId = await createRoom(key, 'color-named-room')

    const res = await sendMessage(key, roomId, 'bot', 'blue message', 'agent', 'blue')
    const msg = await res.json() as { color: string }
    expect(msg.color).toBe('blue')
  })

  it('color can be set to a hex code', async () => {
    const key = await createKey()
    const roomId = await createRoom(key, 'color-hex-room')

    const res = await sendMessage(key, roomId, 'bot', 'hex message', 'agent', '#418FAF')
    const msg = await res.json() as { color: string }
    expect(msg.color).toBe('#418FAF')
  })

  it('color is included in GET messages response', async () => {
    const key = await createKey()
    const roomId = await createRoom(key, 'color-list-room')

    await sendMessage(key, roomId, 'alice', 'no color')
    await sendMessage(key, roomId, 'bot', 'with color', 'agent', 'cyan')

    const res = await SELF.fetch(`http://localhost/api/rooms/${roomId}/messages`, {
      headers: { Authorization: `Bearer ${key}` },
    })
    const messages = await res.json() as { color: string | null }[]
    expect(messages).toHaveLength(2)
    expect(messages[0].color).toBeNull()
    expect(messages[1].color).toBe('cyan')
  })
})

describe('Team Info', () => {
  const teamInfoPayload = {
    team_name: 'test-team',
    members: [
      { name: 'agent-1', color: 'blue', role: 'general-purpose', model: 'claude-opus-4-6', status: 'active', joinedAt: 1234567890 },
    ],
  }

  it('POST /api/rooms/:id/team-info pushes team info', async () => {
    const key = await createKey()
    const roomId = await createRoom(key, 'team-room')

    const res = await SELF.fetch(`http://localhost/api/rooms/${roomId}/team-info`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(teamInfoPayload),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { ok: boolean }
    expect(body.ok).toBe(true)
  })

  it('returns 404 for non-existent room', async () => {
    const key = await createKey()

    const res = await SELF.fetch('http://localhost/api/rooms/nonexistent/team-info', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(teamInfoPayload),
    })
    expect(res.status).toBe(404)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('room not found')
  })

  it('requires auth', async () => {
    const res = await SELF.fetch('http://localhost/api/rooms/any-room/team-info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(teamInfoPayload),
    })
    expect(res.status).toBe(401)
  })
})

describe('Share Tokens', () => {
  async function createShareToken(key: string) {
    return SELF.fetch('http://localhost/api/auth/share', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
    })
  }

  it('POST /api/auth/share creates a share token', async () => {
    const key = await createKey()

    const res = await createShareToken(key)
    expect(res.status).toBe(201)
    const body = await res.json() as { token: string; url: string }
    expect(body.token).toBeTruthy()
    expect(body.url).toContain('/auth/')
    expect(body.url).toContain(body.token)
  })

  it('GET /api/auth/claim/:token claims a valid token', async () => {
    const key = await createKey()

    const shareRes = await createShareToken(key)
    const { token } = await shareRes.json() as { token: string }

    const claimRes = await SELF.fetch(`http://localhost/api/auth/claim/${token}`)
    expect(claimRes.status).toBe(200)
    const body = await claimRes.json() as { api_key: string }
    expect(body.api_key).toBe(key)
  })

  it('GET /api/auth/claim/:token fails for already-used token', async () => {
    const key = await createKey()

    const shareRes = await createShareToken(key)
    const { token } = await shareRes.json() as { token: string }

    // First claim succeeds
    const claim1 = await SELF.fetch(`http://localhost/api/auth/claim/${token}`)
    expect(claim1.status).toBe(200)

    // Second claim fails
    const claim2 = await SELF.fetch(`http://localhost/api/auth/claim/${token}`)
    expect(claim2.status).toBe(404)
    const body = await claim2.json() as { error: string }
    expect(body.error).toBe('Invalid or expired link')
  })

  it('GET /api/auth/claim/:token fails for expired token', async () => {
    const key = await createKey()

    // Create a share token, then manually set its expires_at to the past
    const shareRes = await createShareToken(key)
    const { token } = await shareRes.json() as { token: string }

    await env.DB.prepare(
      'UPDATE share_tokens SET expires_at = ? WHERE token = ?'
    ).bind('2020-01-01T00:00:00.000Z', token).run()

    const claimRes = await SELF.fetch(`http://localhost/api/auth/claim/${token}`)
    expect(claimRes.status).toBe(404)
    const body = await claimRes.json() as { error: string }
    expect(body.error).toBe('Invalid or expired link')
  })

  it('GET /api/auth/claim/:token fails for non-existent token', async () => {
    const res = await SELF.fetch('http://localhost/api/auth/claim/nonexistent-token')
    expect(res.status).toBe(404)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Invalid or expired link')
  })
})

describe('Lobby', () => {
  it('GET /api/lobby/ws rejects without auth', async () => {
    const res = await SELF.fetch('http://localhost/api/lobby/ws', {
      headers: { Upgrade: 'websocket' },
    })
    expect(res.status).toBe(401)
  })

  it('GET /api/lobby/ws rejects non-websocket request', async () => {
    const key = await createKey()
    const res = await SELF.fetch('http://localhost/api/lobby/ws', {
      headers: { Authorization: `Bearer ${key}` },
    })
    expect(res.status).toBe(426)
  })

  it('POST /api/rooms returns room_created event shape', async () => {
    const key = await createKey()

    const res = await SELF.fetch('http://localhost/api/rooms', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'lobby-test' }),
    })
    expect(res.status).toBe(201)
    const body = await res.json() as { id: string; name: string }
    expect(body.id).toBeTruthy()
    expect(body.name).toBe('lobby-test')
  })
})
