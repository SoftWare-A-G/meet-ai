import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { ZodError } from 'zod'
import type { MeetAiClient } from '@meet-ai/cli/types'

mock.module('@meet-ai/cli/config', () => ({
  getMeetAiConfig: mock(() => ({ url: 'https://meet-ai.cc', key: undefined })),
}))

mock.module('@meet-ai/cli/lib/project', () => ({
  detectProject: mock(() => null),
}))

function mockClient(overrides: Partial<MeetAiClient> = {}): MeetAiClient {
  return {
    listRooms: mock(() => Promise.resolve([])),
    createRoom: mock(() => Promise.resolve({ id: 'room-123', name: 'My Room', projectId: null, createdAt: '2026-01-01 00:00:00' })),
    updateRoom: mock(() => Promise.reject(new Error('not implemented'))),
    findProject: mock(() => Promise.resolve(null)),
    upsertProject: mock(() => Promise.reject(new Error('not implemented'))),
    sendMessage: mock(() => Promise.reject(new Error('not implemented'))),
    getMessages: mock(() => Promise.reject(new Error('not implemented'))),
    listen: mock(() => {
      throw new Error('not implemented')
    }),
    sendLog: mock(() => Promise.reject(new Error('not implemented'))),
    sendTeamInfo: mock(() => Promise.reject(new Error('not implemented'))),
    sendCommands: mock(() => Promise.reject(new Error('not implemented'))),
    sendTasks: mock(() => Promise.reject(new Error('not implemented'))),
    getMessageAttachments: mock(() => Promise.reject(new Error('not implemented'))),
    downloadAttachment: mock(() => Promise.reject(new Error('not implemented'))),
    listenLobby: mock(() => {
      throw new Error('not implemented')
    }),
    generateKey: mock(() => Promise.reject(new Error('not implemented'))),
    deleteRoom: mock(() => Promise.reject(new Error('not implemented'))),
    sendTerminalData: mock(() => Promise.reject(new Error('not implemented'))),
    ...overrides,
  } as MeetAiClient
}

describe('createRoom', () => {
  beforeEach(() => {
    mock.restore()
  })

  it('creates a room and returns the result', async () => {
    const { createRoom } = await import('./usecase')
    const client = mockClient({
      createRoom: mock(() => Promise.resolve({ id: 'abc-123', name: 'Test Room', projectId: null, createdAt: '2026-01-01 00:00:00' })),
    })

    const result = await createRoom(client, { name: 'Test Room', silent: true })

    expect(result).toEqual({ id: 'abc-123', name: 'Test Room', projectId: null, createdAt: '2026-01-01 00:00:00' })
    expect(client.createRoom).toHaveBeenCalledWith('Test Room', undefined)
  })

  it('throws ZodError when name is empty', async () => {
    const { createRoom } = await import('./usecase')
    const client = mockClient()

    expect(() => createRoom(client, { name: '' })).toThrow(ZodError)
    expect(client.createRoom).not.toHaveBeenCalled()
  })

  it('propagates API errors from the client', async () => {
    const { createRoom } = await import('./usecase')
    const client = mockClient({
      createRoom: mock(() => Promise.reject(new Error('HTTP 500'))),
    })

    await expect(createRoom(client, { name: 'Failing Room', silent: true })).rejects.toThrow('HTTP 500')
  })
})
