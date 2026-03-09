import { test, expect, beforeEach } from 'bun:test'
import type IHttpTransport from '@meet-ai/cli/domain/interfaces/IHttpTransport'
import type { RequestOptions } from '@meet-ai/cli/domain/interfaces/IHttpTransport'
import MessageRepository from '@meet-ai/cli/domain/repositories/MessageRepository'
import RoomRepository from '@meet-ai/cli/domain/repositories/RoomRepository'

interface Call {
  method: string
  path: string
  body?: unknown
  opts?: RequestOptions
}

function createMockTransport(responses: Record<string, unknown> = {}) {
  const calls: Call[] = []

  const transport: IHttpTransport = {
    async postJson<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T> {
      calls.push({ method: 'postJson', path, body, opts })
      return (responses[`postJson:${path}`] ?? {}) as T
    },
    async postText(path: string, body?: unknown, opts?: RequestOptions): Promise<string> {
      calls.push({ method: 'postText', path, body, opts })
      return (responses[`postText:${path}`] ?? 'ok') as string
    },
    async getJson<T>(path: string, opts?: RequestOptions): Promise<T> {
      calls.push({ method: 'getJson', path, opts })
      return (responses[`getJson:${path}`] ?? []) as T
    },
    async getRaw(path: string): Promise<Response> {
      calls.push({ method: 'getRaw', path })
      return new Response('raw')
    },
    async del(path: string): Promise<void> {
      calls.push({ method: 'del', path })
    },
  }

  return { transport, calls }
}

// --- MessageRepository ---

let mock: ReturnType<typeof createMockTransport>

beforeEach(() => {
  mock = createMockTransport()
})

test('MessageRepository.send calls postJson with correct path and body', async () => {
  const fakeMsg = { id: '1', roomId: 'r1', sender: 'bot', sender_type: 'agent', content: 'hi' }
  mock = createMockTransport({ 'postJson:/api/rooms/r1/messages': fakeMsg })
  const repo = new MessageRepository(mock.transport)

  const result = await repo.send('r1', 'bot', 'hi', '#ff0000')

  expect(result).toEqual({ id: '1', roomId: 'r1', sender: 'bot', sender_type: 'agent', content: 'hi' })
  expect(mock.calls).toHaveLength(1)
  const call = mock.calls[0]
  expect(call.method).toBe('postJson')
  expect(call.path).toBe('/api/rooms/r1/messages')
  expect(call.body).toEqual({ sender: 'bot', content: 'hi', sender_type: 'agent', color: '#ff0000' })
  expect(call.opts).toEqual({ retry: { maxRetries: 3, baseDelay: 1000 } })
})

test('MessageRepository.send omits color when not provided', async () => {
  const repo = new MessageRepository(mock.transport)

  await repo.send('r1', 'bot', 'hi')

  const call = mock.calls[0]
  expect(call.body).toEqual({ sender: 'bot', content: 'hi', sender_type: 'agent' })
  expect((call.body as Record<string, unknown>).color).toBeUndefined()
})

test('MessageRepository.list calls getJson with correct path and query params', async () => {
  const fakeMsgs = [{ id: '1', roomId: 'r1', sender: 'a', sender_type: 'agent', content: '' }, { id: '2', roomId: 'r1', sender: 'b', sender_type: 'human', content: '' }]
  mock = createMockTransport({ 'getJson:/api/rooms/r1/messages': fakeMsgs })
  const repo = new MessageRepository(mock.transport)

  const result = await repo.list('r1', { after: '5', exclude: 'bot', senderType: 'human' })

  expect(result).toEqual(fakeMsgs)
  expect(mock.calls).toHaveLength(1)
  const call = mock.calls[0]
  expect(call.method).toBe('getJson')
  expect(call.path).toBe('/api/rooms/r1/messages')
  expect(call.opts).toEqual({ query: { after: '5', exclude: 'bot', sender_type: 'human' } })
})

test('MessageRepository.list sends empty query when no options', async () => {
  const repo = new MessageRepository(mock.transport)

  await repo.list('r1')

  const call = mock.calls[0]
  expect(call.opts).toEqual({ query: {} })
})

test('MessageRepository.sendLog calls postJson with correct path, body, color, and messageId', async () => {
  const fakeLog = { id: 'log1', roomId: 'r1', sender: 'agent', sender_type: 'agent', content: 'log entry' }
  mock = createMockTransport({ 'postJson:/api/rooms/r1/logs': fakeLog })
  const repo = new MessageRepository(mock.transport)

  const result = await repo.sendLog('r1', 'agent', 'log entry', { color: '#00ff00', messageId: 'msg-42' })

  expect(result).toEqual(fakeLog)
  expect(mock.calls).toHaveLength(1)
  const call = mock.calls[0]
  expect(call.method).toBe('postJson')
  expect(call.path).toBe('/api/rooms/r1/logs')
  expect(call.body).toEqual({ sender: 'agent', content: 'log entry', color: '#00ff00', message_id: 'msg-42' })
  expect(call.opts).toEqual({ retry: { maxRetries: 3, baseDelay: 1000 } })
})

test('MessageRepository.sendLog omits color and messageId when not provided', async () => {
  const repo = new MessageRepository(mock.transport)

  await repo.sendLog('r1', 'agent', 'log')

  const call = mock.calls[0]
  expect(call.body).toEqual({ sender: 'agent', content: 'log' })
})

// --- RoomRepository ---

test('RoomRepository.create calls postJson with room name', async () => {
  const fakeRoom = { id: 'room-1', name: 'My Room', created_at: '2026-01-01 00:00:00' }
  mock = createMockTransport({ 'postJson:/api/rooms': fakeRoom })
  const repo = new RoomRepository(mock.transport)

  const result = await repo.create('My Room')

  expect(result).toEqual(fakeRoom)
  expect(mock.calls).toHaveLength(1)
  const call = mock.calls[0]
  expect(call.method).toBe('postJson')
  expect(call.path).toBe('/api/rooms')
  expect(call.body).toEqual({ name: 'My Room' })
})

test('RoomRepository.delete calls del with correct path', async () => {
  const repo = new RoomRepository(mock.transport)

  await repo.delete('room-1')

  expect(mock.calls).toHaveLength(1)
  expect(mock.calls[0].method).toBe('del')
  expect(mock.calls[0].path).toBe('/api/rooms/room-1')
})

test('RoomRepository.sendTeamInfo calls postText with parsed JSON payload', async () => {
  const repo = new RoomRepository(mock.transport)
  const payload = JSON.stringify({ members: [{ name: 'agent-1' }] })

  await repo.sendTeamInfo('r1', payload)

  expect(mock.calls).toHaveLength(1)
  const call = mock.calls[0]
  expect(call.method).toBe('postText')
  expect(call.path).toBe('/api/rooms/r1/team-info')
  expect(call.body).toEqual({ members: [{ name: 'agent-1' }] })
  expect(call.opts).toEqual({ retry: { maxRetries: 3, baseDelay: 1000 } })
})

test('RoomRepository.sendCommands calls postText with parsed JSON payload', async () => {
  const repo = new RoomRepository(mock.transport)
  const payload = JSON.stringify({ commands: ['ls', 'pwd'] })

  await repo.sendCommands('r1', payload)

  expect(mock.calls).toHaveLength(1)
  const call = mock.calls[0]
  expect(call.method).toBe('postText')
  expect(call.path).toBe('/api/rooms/r1/commands')
  expect(call.body).toEqual({ commands: ['ls', 'pwd'] })
  expect(call.opts).toEqual({ retry: { maxRetries: 3, baseDelay: 1000 } })
})

test('RoomRepository.sendTasks calls postText with parsed JSON payload', async () => {
  const repo = new RoomRepository(mock.transport)
  const payload = JSON.stringify({ tasks: [{ id: 1, title: 'Do stuff' }] })

  await repo.sendTasks('r1', payload)

  expect(mock.calls).toHaveLength(1)
  const call = mock.calls[0]
  expect(call.method).toBe('postText')
  expect(call.path).toBe('/api/rooms/r1/tasks')
  expect(call.body).toEqual({ tasks: [{ id: 1, title: 'Do stuff' }] })
  expect(call.opts).toEqual({ retry: { maxRetries: 3, baseDelay: 1000 } })
})

test('RoomRepository.sendTerminalData calls postJson and silences errors', async () => {
  const failTransport: IHttpTransport = {
    async postJson(): Promise<never> {
      throw new Error('network failure')
    },
    async postText() { return '' },
    async getJson() { return {} as never },
    async getRaw() { return new Response() },
    async del() {},
  }
  const repo = new RoomRepository(failTransport)

  // Should not throw
  await repo.sendTerminalData('r1', 'terminal output')
})

test('RoomRepository.sendTerminalData calls postJson with correct path and body', async () => {
  const repo = new RoomRepository(mock.transport)

  await repo.sendTerminalData('r1', 'terminal data')

  expect(mock.calls).toHaveLength(1)
  const call = mock.calls[0]
  expect(call.method).toBe('postJson')
  expect(call.path).toBe('/api/rooms/r1/terminal')
  expect(call.body).toEqual({ data: 'terminal data' })
})
