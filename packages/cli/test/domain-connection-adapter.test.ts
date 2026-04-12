import { test, expect, mock, beforeEach, afterEach } from 'bun:test'
import { Result } from 'better-result'
import { createApiClient } from '@meet-ai/cli/domain/adapters/api-client'
import ConnectionAdapter from '@meet-ai/cli/domain/adapters/ConnectionAdapter'

const TEST_URL = 'https://meet-ai.cc'
const TEST_KEY = 'mai_test1234567890'

function createClient() {
  return createApiClient(TEST_URL, TEST_KEY)
}

// Suppress wsLog output during tests
beforeEach(() => {
  console.error = () => {}
})

// --- Mock WebSocket for listen/listenLobby tests ---

class MockWebSocket {
  static OPEN = 1
  static instances: MockWebSocket[] = []

  url: string
  options: unknown
  readyState = MockWebSocket.OPEN
  onopen: ((ev?: unknown) => void) | null = null
  onmessage: ((ev: { data: string }) => void) | null = null
  onclose: ((ev: { code: number; reason?: string }) => void) | null = null
  onerror: (() => void) | null = null
  send = mock(() => {})
  close = mock(() => {})

  constructor(url: string, options?: unknown) {
    this.url = url
    this.options = options
    MockWebSocket.instances.push(this)
    // Simulate async open
    setTimeout(() => this.onopen?.(), 0)
  }
}

let origWebSocket: typeof globalThis.WebSocket
let origFetch: typeof globalThis.fetch

beforeEach(() => {
  MockWebSocket.instances = []
  origWebSocket = globalThis.WebSocket
  origFetch = globalThis.fetch
  // @ts-expect-error mock
  globalThis.WebSocket = MockWebSocket
})

afterEach(() => {
  globalThis.WebSocket = origWebSocket
  globalThis.fetch = origFetch
})

// --- generateKey ---

test('generateKey returns Result.ok with key and prefix', async () => {
  globalThis.fetch = mock(() =>
    Promise.resolve(new Response(JSON.stringify({ key: 'mai_abc123', prefix: 'mai_abc' }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    }))
  ) as unknown as typeof globalThis.fetch
  const adapter = new ConnectionAdapter(createClient(), TEST_URL, TEST_KEY)

  const result = await adapter.generateKey()

  expect(Result.isOk(result)).toBe(true)
  if (Result.isOk(result)) {
    expect(result.value).toEqual({ key: 'mai_abc123', prefix: 'mai_abc' })
  }
})

test('generateKey returns Err on API failure', async () => {
  globalThis.fetch = mock(() =>
    Promise.resolve(new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    }))
  ) as unknown as typeof globalThis.fetch
  const adapter = new ConnectionAdapter(createClient(), TEST_URL, 'badkey')

  const result = await adapter.generateKey()

  expect(Result.isError(result)).toBe(true)
})

// --- listen: URL construction ---

test('listen constructs correct WebSocket URL with auth header', () => {
  const adapter = new ConnectionAdapter(createClient(), TEST_URL, 'tok123')

  adapter.listen('room-abc')

  expect(MockWebSocket.instances).toHaveLength(1)
  expect(MockWebSocket.instances[0].url).toBe('wss://meet-ai.cc/api/rooms/room-abc/ws?client=cli')
  expect(MockWebSocket.instances[0].options).toEqual({ headers: { Authorization: 'Bearer tok123' } })
})

test('listen constructs WebSocket URL without token when no apiKey', () => {
  const adapter = new ConnectionAdapter(createClient(), TEST_URL)

  adapter.listen('room-xyz')

  expect(MockWebSocket.instances[0].url).toBe('wss://meet-ai.cc/api/rooms/room-xyz/ws?client=cli')
})

test('listen converts http to ws in URL', () => {
  const adapter = new ConnectionAdapter(createClient(), 'http://localhost:8787')

  adapter.listen('test-room')

  expect(MockWebSocket.instances[0].url).toBe('ws://localhost:8787/api/rooms/test-room/ws?client=cli')
})

// --- listen: message delivery ---

test('listen calls onMessage for incoming messages', async () => {
  const adapter = new ConnectionAdapter(createClient(), 'https://example.com', 'key')
  const received: unknown[] = []

  adapter.listen('room1', {
    onMessage: (msg) => received.push(msg),
  })

  await new Promise((resolve) => setTimeout(resolve, 10))

  const ws = MockWebSocket.instances[0]
  ws.onmessage?.({ data: JSON.stringify({ id: 'msg1', sender: 'alice', text: 'hi' }) })

  expect(received).toHaveLength(1)
  expect((received[0] as { id: string }).id).toBe('msg1')
})

test('listen deduplicates messages by id', async () => {
  const adapter = new ConnectionAdapter(createClient(), 'https://example.com', 'key')
  const received: unknown[] = []

  adapter.listen('room1', {
    onMessage: (msg) => received.push(msg),
  })

  await new Promise((resolve) => setTimeout(resolve, 10))

  const ws = MockWebSocket.instances[0]
  const msg = JSON.stringify({ id: 'dup1', sender: 'bob', text: 'hello' })
  ws.onmessage?.({ data: msg })
  ws.onmessage?.({ data: msg })
  ws.onmessage?.({ data: msg })

  expect(received).toHaveLength(1)
})

test('listen filters by exclude option', async () => {
  const adapter = new ConnectionAdapter(createClient(), 'https://example.com', 'key')
  const received: unknown[] = []

  adapter.listen('room1', {
    exclude: 'bot',
    onMessage: (msg) => received.push(msg),
  })

  await new Promise((resolve) => setTimeout(resolve, 10))

  const ws = MockWebSocket.instances[0]
  ws.onmessage?.({ data: JSON.stringify({ id: 'm1', sender: 'bot', text: 'ignored' }) })
  ws.onmessage?.({ data: JSON.stringify({ id: 'm2', sender: 'human', text: 'kept' }) })

  expect(received).toHaveLength(1)
  expect((received[0] as { sender: string }).sender).toBe('human')
})

test('listen filters by senderType option', async () => {
  const adapter = new ConnectionAdapter(createClient(), 'https://example.com', 'key')
  const received: unknown[] = []

  adapter.listen('room1', {
    senderType: 'human',
    onMessage: (msg) => received.push(msg),
  })

  await new Promise((resolve) => setTimeout(resolve, 10))

  const ws = MockWebSocket.instances[0]
  ws.onmessage?.({
    data: JSON.stringify({ id: 'm1', sender: 'a', sender_type: 'agent', text: 'no' }),
  })
  ws.onmessage?.({
    data: JSON.stringify({ id: 'm2', sender: 'b', sender_type: 'human', text: 'yes' }),
  })

  expect(received).toHaveLength(1)
  expect((received[0] as { sender: string }).sender).toBe('b')
})

test('listen ignores pong messages', async () => {
  const adapter = new ConnectionAdapter(createClient(), 'https://example.com', 'key')
  const received: unknown[] = []

  adapter.listen('room1', {
    onMessage: (msg) => received.push(msg),
  })

  await new Promise((resolve) => setTimeout(resolve, 10))

  const ws = MockWebSocket.instances[0]
  ws.onmessage?.({ data: JSON.stringify({ type: 'pong' }) })

  expect(received).toHaveLength(0)
})

test('listen ignores terminal_data messages', async () => {
  const adapter = new ConnectionAdapter(createClient(), 'https://example.com', 'key')
  const received: unknown[] = []

  adapter.listen('room1', {
    onMessage: (msg) => received.push(msg),
  })

  await new Promise((resolve) => setTimeout(resolve, 10))

  const ws = MockWebSocket.instances[0]
  ws.onmessage?.({ data: JSON.stringify({ type: 'terminal_data', data: 'ls\n' }) })

  expect(received).toHaveLength(0)
})

test('listen forwards terminal_subscribe messages via onMessage', async () => {
  const adapter = new ConnectionAdapter(createClient(), 'https://example.com', 'key')
  const received: unknown[] = []

  adapter.listen('room1', {
    onMessage: (msg) => received.push(msg),
  })

  await new Promise((resolve) => setTimeout(resolve, 10))

  const ws = MockWebSocket.instances[0]
  ws.onmessage?.({ data: JSON.stringify({ type: 'terminal_subscribe' }) })

  expect(received).toHaveLength(1)
  expect((received[0] as { type: string }).type).toBe('terminal_subscribe')
})

// --- listen: seen set eviction ---

test('listen evicts oldest seen ids when set exceeds 200', async () => {
  const adapter = new ConnectionAdapter(createClient(), 'https://example.com', 'key')
  const received: unknown[] = []

  adapter.listen('room1', {
    onMessage: (msg) => received.push(msg),
  })

  await new Promise((resolve) => setTimeout(resolve, 10))

  const ws = MockWebSocket.instances[0]

  // Send 201 unique messages
  for (let i = 0; i < 201; i++) {
    ws.onmessage?.({ data: JSON.stringify({ id: `msg-${i}`, sender: 'a' }) })
  }
  expect(received).toHaveLength(201)

  // Re-send the first message (id msg-0) — should NOT be deduped since it was evicted
  ws.onmessage?.({ data: JSON.stringify({ id: 'msg-0', sender: 'a' }) })
  expect(received).toHaveLength(202)

  // Re-send the last message (id msg-200) — should be deduped (still in set)
  ws.onmessage?.({ data: JSON.stringify({ id: 'msg-200', sender: 'a' }) })
  expect(received).toHaveLength(202)
})

// --- listenLobby: URL construction ---

test('listenLobby constructs correct WebSocket URL with auth header', () => {
  const adapter = new ConnectionAdapter(createClient(), TEST_URL, 'key1')

  adapter.listenLobby()

  expect(MockWebSocket.instances[0].url).toBe('wss://meet-ai.cc/api/lobby/ws')
  expect(MockWebSocket.instances[0].options).toEqual({ headers: { Authorization: 'Bearer key1' } })
})

test('listenLobby constructs URL without token when no apiKey', () => {
  const adapter = new ConnectionAdapter(createClient(), 'http://localhost:8787')

  adapter.listenLobby()

  expect(MockWebSocket.instances[0].url).toBe('ws://localhost:8787/api/lobby/ws')
})

// --- listenLobby: message handling ---

test('listenLobby calls onRoomCreated for room_created events', async () => {
  const adapter = new ConnectionAdapter(createClient(), 'https://example.com', 'key')
  const rooms: { id: string; name: string }[] = []

  adapter.listenLobby({
    onRoomCreated: (id, name) => rooms.push({ id, name }),
  })

  await new Promise((resolve) => setTimeout(resolve, 10))

  const ws = MockWebSocket.instances[0]
  ws.onmessage?.({
    data: JSON.stringify({ type: 'room_created', id: 'r1', name: 'Test Room' }),
  })

  expect(rooms).toHaveLength(1)
  expect(rooms[0]).toEqual({ id: 'r1', name: 'Test Room' })
})

test('listenLobby calls onSpawnRequest for spawn_request events', async () => {
  const adapter = new ConnectionAdapter(createClient(), 'https://example.com', 'key')
  const spawns: { roomName: string; codingAgent: string }[] = []

  adapter.listenLobby({
    onSpawnRequest: (request) => spawns.push(request),
  })

  await new Promise((resolve) => setTimeout(resolve, 10))

  const ws = MockWebSocket.instances[0]
  ws.onmessage?.({
    data: JSON.stringify({ type: 'spawn_request', room_name: 'new-agent-room', coding_agent: 'codex' }),
  })

  expect(spawns).toHaveLength(1)
  expect(spawns[0]).toEqual({ roomName: 'new-agent-room', codingAgent: 'codex' })
})

test('listenLobby ignores pong messages', async () => {
  const adapter = new ConnectionAdapter(createClient(), 'https://example.com', 'key')
  const rooms: unknown[] = []

  adapter.listenLobby({
    onRoomCreated: (id, name) => rooms.push({ id, name }),
  })

  await new Promise((resolve) => setTimeout(resolve, 10))

  const ws = MockWebSocket.instances[0]
  ws.onmessage?.({ data: JSON.stringify({ type: 'pong' }) })

  expect(rooms).toHaveLength(0)
})

test('listenLobby ignores malformed JSON', async () => {
  const adapter = new ConnectionAdapter(createClient(), 'https://example.com', 'key')
  const rooms: unknown[] = []

  adapter.listenLobby({
    onRoomCreated: (id, name) => rooms.push({ id, name }),
  })

  await new Promise((resolve) => setTimeout(resolve, 10))

  const ws = MockWebSocket.instances[0]
  // Should not throw
  ws.onmessage?.({ data: 'not json {{{' })

  expect(rooms).toHaveLength(0)
})

// --- listen: catch-up on reconnect ---

test('listen fetches missed messages on reconnect via hc client', async () => {
  const missedMessages = [
    { id: 'missed1', room_id: 'room1', sender: 'alice', sender_type: 'human', content: 'you missed this', color: null },
    { id: 'missed2', room_id: 'room1', sender: 'bob', sender_type: 'agent', content: 'and this', color: null },
  ]
  const mockFetch = mock(() =>
    Promise.resolve(new Response(JSON.stringify(missedMessages), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))
  ) as unknown as typeof globalThis.fetch
  globalThis.fetch = mockFetch

  const adapter = new ConnectionAdapter(createClient(), 'https://example.com', 'key')
  const received: unknown[] = []

  adapter.listen('room1', {
    onMessage: (msg) => received.push(msg),
  })

  await new Promise((resolve) => setTimeout(resolve, 10))

  // Deliver a message to set lastSeenId
  const ws = MockWebSocket.instances[0]
  ws.onmessage?.({ data: JSON.stringify({ id: 'first', sender: 'x' }) })
  expect(received).toHaveLength(1)

  // Simulate reconnect: trigger onopen again (simulating new connection after reconnect)
  ws.onopen?.()

  await new Promise((resolve) => setTimeout(resolve, 10))

  // Should have fetched catch-up and delivered missed messages
  expect(mockFetch).toHaveBeenCalled()
  // first + missed1 + missed2
  expect(received).toHaveLength(3)
})

// --- returns WebSocket ---

test('listen returns a WebSocket instance', () => {
  const adapter = new ConnectionAdapter(createClient(), 'https://example.com')

  const ws = adapter.listen('room1')

  expect(ws).toBeInstanceOf(MockWebSocket)
})

test('listenLobby returns a WebSocket instance', () => {
  const adapter = new ConnectionAdapter(createClient(), 'https://example.com')

  const ws = adapter.listenLobby()

  expect(ws).toBeInstanceOf(MockWebSocket)
})
