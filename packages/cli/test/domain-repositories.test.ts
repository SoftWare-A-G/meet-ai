import { test, expect, beforeEach, afterEach, mock } from 'bun:test'
import { Result } from 'better-result'
import { createApiClient } from '@meet-ai/cli/domain/adapters/api-client'
import AttachmentRepository from '@meet-ai/cli/domain/repositories/AttachmentRepository'
import MessageRepository from '@meet-ai/cli/domain/repositories/MessageRepository'
import ProjectRepository from '@meet-ai/cli/domain/repositories/ProjectRepository'
import RoomRepository from '@meet-ai/cli/domain/repositories/RoomRepository'

const TEST_URL = 'https://test.example.com'
const TEST_KEY = 'mai_test1234567890'

function createClient() {
  return createApiClient(TEST_URL, TEST_KEY)
}

let origFetch: typeof globalThis.fetch
let fetchCalls: { url: string; method: string; body?: Record<string, unknown>; headers?: Record<string, string> }[]

function mockFetchResponse(body: unknown, status = 200) {
  const jsonBody = typeof body === 'string' ? body : JSON.stringify(body)
  globalThis.fetch = mock(() =>
    Promise.resolve(new Response(jsonBody, {
      status,
      headers: { 'Content-Type': 'application/json' },
    }))
  ) as unknown as typeof globalThis.fetch
}

function mockFetchCapture(body: unknown, status = 200) {
  const jsonBody = typeof body === 'string' ? body : JSON.stringify(body)
  fetchCalls = []
  globalThis.fetch = mock((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    fetchCalls.push({
      url,
      method: init?.method ?? 'GET',
      body: init?.body ? JSON.parse(init.body.toString()) : undefined,
      headers: init?.headers ? Object.fromEntries(
        init.headers instanceof Headers
          ? init.headers.entries()
          : Array.isArray(init.headers)
            ? init.headers
            : Object.entries(init.headers)
      ) : undefined,
    })
    return Promise.resolve(new Response(jsonBody, {
      status,
      headers: { 'Content-Type': 'application/json' },
    }))
  }) as unknown as typeof globalThis.fetch
}

beforeEach(() => {
  origFetch = globalThis.fetch
  fetchCalls = []
})

afterEach(() => {
  globalThis.fetch = origFetch
})

// --- MessageRepository ---

test('MessageRepository.send calls POST with correct body and returns mapped Message', async () => {
  const fakeMsg = { id: '1', room_id: 'r1', sender: 'bot', sender_type: 'agent', content: 'hi', color: null }
  mockFetchCapture(fakeMsg, 201)
  const repo = new MessageRepository(createClient())

  const result = await repo.send('r1', 'bot', 'hi', '#ff0000')

  expect(Result.isOk(result)).toBe(true)
  if (Result.isOk(result)) {
    expect(result.value).toEqual({ id: '1', roomId: 'r1', sender: 'bot', sender_type: 'agent', content: 'hi' })
  }
  expect(fetchCalls).toHaveLength(1)
  expect(fetchCalls[0].method).toBe('POST')
  expect(fetchCalls[0].url).toContain('/api/rooms/r1/messages')
  expect(fetchCalls[0].body).toEqual({ sender: 'bot', content: 'hi', sender_type: 'agent', color: '#ff0000' })
})

test('MessageRepository.send omits color when not provided', async () => {
  const fakeMsg = { id: '1', room_id: 'r1', sender: 'bot', sender_type: 'agent', content: 'hi', color: null }
  mockFetchCapture(fakeMsg, 201)
  const repo = new MessageRepository(createClient())

  await repo.send('r1', 'bot', 'hi')

  expect(fetchCalls[0].body).toEqual({ sender: 'bot', content: 'hi', sender_type: 'agent' })
  expect(fetchCalls[0].body!.color).toBeUndefined()
})

test('MessageRepository.list calls GET with correct query params', async () => {
  const fakeMsgs = [
    { id: '1', room_id: 'r1', sender: 'a', sender_type: 'agent', content: '', color: null },
    { id: '2', room_id: 'r1', sender: 'b', sender_type: 'human', content: '', color: null },
  ]
  mockFetchCapture(fakeMsgs)
  const repo = new MessageRepository(createClient())

  const result = await repo.list('r1', { after: '5', exclude: 'bot', senderType: 'human' })

  expect(Result.isOk(result)).toBe(true)
  if (Result.isOk(result)) {
    expect(result.value).toHaveLength(2)
    expect(result.value[0].roomId).toBe('r1')
  }
  expect(fetchCalls).toHaveLength(1)
  expect(fetchCalls[0].method).toBe('GET')
  expect(fetchCalls[0].url).toContain('/api/rooms/r1/messages')
  expect(fetchCalls[0].url).toContain('after=5')
  expect(fetchCalls[0].url).toContain('exclude=bot')
  expect(fetchCalls[0].url).toContain('sender_type=human')
})

test('MessageRepository.list with no options sends no query params', async () => {
  mockFetchCapture([])
  const repo = new MessageRepository(createClient())

  await repo.list('r1')

  expect(fetchCalls[0].url).toContain('/api/rooms/r1/messages')
})

test('MessageRepository.sendLog calls POST with correct body', async () => {
  const fakeLog = { id: 'log1', room_id: 'r1', sender: 'agent', content: 'log entry', color: '#00ff00', message_id: 'msg-42', type: 'log', seq: 1, created_at: '2026-01-01' }
  mockFetchCapture(fakeLog, 201)
  const repo = new MessageRepository(createClient())

  const result = await repo.sendLog('r1', 'agent', 'log entry', { color: '#00ff00', messageId: 'msg-42' })

  expect(Result.isOk(result)).toBe(true)
  if (Result.isOk(result)) {
    expect(result.value.id).toBe('log1')
    expect(result.value.roomId).toBe('r1')
  }
  expect(fetchCalls).toHaveLength(1)
  expect(fetchCalls[0].method).toBe('POST')
  expect(fetchCalls[0].url).toContain('/api/rooms/r1/logs')
  expect(fetchCalls[0].body).toEqual({ sender: 'agent', content: 'log entry', color: '#00ff00', message_id: 'msg-42' })
})

test('MessageRepository.sendLog omits color and messageId when not provided', async () => {
  const fakeLog = { id: 'log1', room_id: 'r1', sender: 'agent', content: 'log', color: null, type: 'log', seq: 1, created_at: '2026-01-01' }
  mockFetchCapture(fakeLog, 201)
  const repo = new MessageRepository(createClient())

  await repo.sendLog('r1', 'agent', 'log')

  expect(fetchCalls[0].body).toEqual({ sender: 'agent', content: 'log' })
})

// --- RoomRepository ---

test('RoomRepository.create calls POST with room name', async () => {
  const fakeRoom = { id: 'room-1', name: 'My Room', project_id: null, created_at: '2026-01-01 00:00:00' }
  mockFetchCapture(fakeRoom, 201)
  const repo = new RoomRepository(createClient())

  const result = await repo.create('My Room')

  expect(Result.isOk(result)).toBe(true)
  if (Result.isOk(result)) {
    expect(result.value).toEqual({ id: 'room-1', name: 'My Room', projectId: null, createdAt: '2026-01-01 00:00:00' })
  }
  expect(fetchCalls).toHaveLength(1)
  expect(fetchCalls[0].method).toBe('POST')
  expect(fetchCalls[0].url).toContain('/api/rooms')
})

test('RoomRepository.create includes project_id when provided', async () => {
  const fakeRoom = { id: 'room-1', name: 'My Room', project_id: 'proj-1', created_at: '2026-01-01 00:00:00' }
  mockFetchCapture(fakeRoom, 201)
  const repo = new RoomRepository(createClient())

  await repo.create('My Room', 'proj-1')

  expect(fetchCalls[0].body!.name).toBe('My Room')
  expect(fetchCalls[0].body!.project_id).toBe('proj-1')
})

test('ProjectRepository.upsert calls POST with project id and name', async () => {
  const fakeProject = { id: 'proj-1', name: 'Repo Name' }
  mockFetchCapture(fakeProject, 201)
  const repo = new ProjectRepository(createClient())

  const result = await repo.upsert('proj-1', 'Repo Name')

  expect(Result.isOk(result)).toBe(true)
  if (Result.isOk(result)) {
    expect(result.value).toEqual(fakeProject)
  }
  expect(fetchCalls[0].method).toBe('POST')
  expect(fetchCalls[0].url).toContain('/api/projects')
  expect(fetchCalls[0].body).toEqual({ id: 'proj-1', name: 'Repo Name' })
})

test('RoomRepository.delete calls DELETE with correct path', async () => {
  mockFetchCapture(null, 204)
  const repo = new RoomRepository(createClient())

  const result = await repo.delete('room-1')

  expect(Result.isOk(result)).toBe(true)
  expect(fetchCalls).toHaveLength(1)
  expect(fetchCalls[0].method).toBe('DELETE')
  expect(fetchCalls[0].url).toContain('/api/rooms/room-1')
})

test('RoomRepository.sendTeamInfo calls POST with parsed JSON payload', async () => {
  mockFetchCapture({ ok: true })
  const repo = new RoomRepository(createClient())
  const payload = JSON.stringify({ team_name: 'team-1', members: [{ name: 'agent-1', color: 'blue', role: 'dev', model: 'opus', status: 'active', joinedAt: 123 }] })

  const result = await repo.sendTeamInfo('r1', payload)

  expect(Result.isOk(result)).toBe(true)
  expect(fetchCalls).toHaveLength(1)
  expect(fetchCalls[0].method).toBe('POST')
  expect(fetchCalls[0].url).toContain('/api/rooms/r1/team-info')
})

test('RoomRepository.sendCommands calls POST with parsed JSON payload', async () => {
  mockFetchCapture({ ok: true })
  const repo = new RoomRepository(createClient())
  const payload = JSON.stringify({ commands: [{ name: 'ls', description: 'list' }] })

  const result = await repo.sendCommands('r1', payload)

  expect(Result.isOk(result)).toBe(true)
  expect(fetchCalls).toHaveLength(1)
  expect(fetchCalls[0].method).toBe('POST')
  expect(fetchCalls[0].url).toContain('/api/rooms/r1/commands')
})

test('RoomRepository.sendTasks calls POST with parsed JSON payload', async () => {
  mockFetchCapture({ ok: true })
  const repo = new RoomRepository(createClient())
  const payload = JSON.stringify({ tasks: [{ id: 1, title: 'Do stuff' }] })

  const result = await repo.sendTasks('r1', payload)

  expect(Result.isOk(result)).toBe(true)
  expect(fetchCalls).toHaveLength(1)
  expect(fetchCalls[0].method).toBe('POST')
  expect(fetchCalls[0].url).toContain('/api/rooms/r1/tasks')
})

test('RoomRepository.sendTerminalData returns Result without throwing on network error', async () => {
  globalThis.fetch = mock(() => Promise.reject(new Error('network failure'))) as unknown as typeof globalThis.fetch
  const repo = new RoomRepository(createClient())

  const result = await repo.sendTerminalData('r1', 'terminal output')

  expect(Result.isError(result)).toBe(true)
})

test('RoomRepository.sendTerminalData calls POST with correct body', async () => {
  mockFetchCapture({ ok: true })
  const repo = new RoomRepository(createClient())

  const result = await repo.sendTerminalData('r1', 'terminal data')

  expect(Result.isOk(result)).toBe(true)
  expect(fetchCalls).toHaveLength(1)
  expect(fetchCalls[0].method).toBe('POST')
  expect(fetchCalls[0].url).toContain('/api/rooms/r1/terminal')
  expect(fetchCalls[0].body).toEqual({ data: 'terminal data' })
})

// --- RoomRepository: mapRoom (snake_case → camelCase) ---

test('RoomRepository.list maps snake_case wire fields to camelCase', async () => {
  const wireRooms = [
    { id: 'r1', name: 'Room A', project_id: 'proj-1', created_at: '2026-03-01 10:00:00', connected: false },
    { id: 'r2', name: 'Room B', project_id: 'proj-2', created_at: '2026-03-02 12:30:00', connected: true },
  ]
  mockFetchResponse(wireRooms)
  const repo = new RoomRepository(createClient())

  const result = await repo.list()

  expect(Result.isOk(result)).toBe(true)
  if (Result.isOk(result)) {
    expect(result.value).toEqual([
      { id: 'r1', name: 'Room A', projectId: 'proj-1', createdAt: '2026-03-01 10:00:00' },
      { id: 'r2', name: 'Room B', projectId: 'proj-2', createdAt: '2026-03-02 12:30:00' },
    ])
  }
})

test('RoomRepository.list maps project_id: null to projectId: null', async () => {
  const wireRooms = [
    { id: 'r1', name: 'No Project', project_id: null, created_at: '2026-01-01 00:00:00', connected: false },
  ]
  mockFetchResponse(wireRooms)
  const repo = new RoomRepository(createClient())

  const result = await repo.list()

  expect(Result.isOk(result)).toBe(true)
  if (Result.isOk(result)) {
    expect(result.value).toHaveLength(1)
    expect(result.value[0].projectId).toBeNull()
    expect(result.value[0].createdAt).toBe('2026-01-01 00:00:00')
  }
})

test('RoomRepository.update maps snake_case response to camelCase', async () => {
  const wireRoom = { id: 'r1', name: 'Updated', project_id: 'proj-99', created_at: '2026-04-01 08:00:00' }
  mockFetchCapture(wireRoom)
  const repo = new RoomRepository(createClient())

  const result = await repo.update('r1', { name: 'Updated', projectId: 'proj-99' })

  expect(Result.isOk(result)).toBe(true)
  if (Result.isOk(result)) {
    expect(result.value).toEqual({ id: 'r1', name: 'Updated', projectId: 'proj-99', createdAt: '2026-04-01 08:00:00' })
  }
})

// --- AttachmentRepository: mapAttachment (snake_case → camelCase) ---

test('AttachmentRepository.listForMessage maps content_type to contentType', async () => {
  const wireAttachments = [
    { id: 'a1', filename: 'photo.png', size: 1024, content_type: 'image/png' },
  ]
  mockFetchResponse(wireAttachments)
  const repo = new AttachmentRepository(createClient())

  const result = await repo.listForMessage('r1', 'm1')

  expect(Result.isOk(result)).toBe(true)
  if (Result.isOk(result)) {
    expect(result.value).toEqual([
      { id: 'a1', filename: 'photo.png', size: 1024, contentType: 'image/png' },
    ])
  }
})

test('AttachmentRepository.listForMessage maps multiple attachments', async () => {
  const wireAttachments = [
    { id: 'a1', filename: 'doc.pdf', size: 2048, content_type: 'application/pdf' },
    { id: 'a2', filename: 'data.json', size: 512, content_type: 'application/json' },
    { id: 'a3', filename: 'clip.mp4', size: 10485760, content_type: 'video/mp4' },
  ]
  mockFetchResponse(wireAttachments)
  const repo = new AttachmentRepository(createClient())

  const result = await repo.listForMessage('r1', 'm2')

  expect(Result.isOk(result)).toBe(true)
  if (Result.isOk(result)) {
    expect(result.value).toHaveLength(3)
    expect(result.value[0].contentType).toBe('application/pdf')
    expect(result.value[1].contentType).toBe('application/json')
    expect(result.value[2].contentType).toBe('video/mp4')
  }
})

test('AttachmentRepository.listForMessage returns empty array when no attachments', async () => {
  mockFetchResponse([])
  const repo = new AttachmentRepository(createClient())

  const result = await repo.listForMessage('r1', 'm3')

  expect(Result.isOk(result)).toBe(true)
  if (Result.isOk(result)) {
    expect(result.value).toEqual([])
  }
})

// --- Error handling ---

test('RoomRepository.list returns Err on HTTP error', async () => {
  mockFetchResponse({ error: 'unauthorized' }, 401)
  const repo = new RoomRepository(createClient())

  const result = await repo.list()

  expect(Result.isError(result)).toBe(true)
  if (Result.isError(result)) {
    expect(result.error.status).toBe(401)
    expect(result.error.message).toBe('unauthorized')
  }
})

test('ProjectRepository.find returns null on 404', async () => {
  mockFetchResponse({ error: 'not found' }, 404)
  const repo = new ProjectRepository(createClient())

  const result = await repo.find('nonexistent')

  expect(Result.isOk(result)).toBe(true)
  if (Result.isOk(result)) {
    expect(result.value).toBeNull()
  }
})
