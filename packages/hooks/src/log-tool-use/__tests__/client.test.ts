import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createHookClient, sendParentMessage, sendLogEntry } from '../client'

const MOCK_URL = 'http://localhost:9999'
const MOCK_KEY = 'mai_test123'

describe('client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('sendParentMessage', () => {
    it('posts to /api/rooms/:id/messages and returns message id', async () => {
      const mockResponse = { id: 'msg-123', room_id: 'room-1', sender: 'hook', content: 'Agent activity', sender_type: 'agent', color: '#6b7280', type: 'message', seq: 1, created_at: '2026-01-01T00:00:00Z', attachment_count: 0 }
      vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(mockResponse), { status: 201, headers: { 'Content-Type': 'application/json' } }))

      const client = createHookClient(MOCK_URL, MOCK_KEY)
      const id = await sendParentMessage(client, 'room-1')

      expect(id).toBe('msg-123')
      expect(fetch).toHaveBeenCalledOnce()
      const [url, init] = vi.mocked(fetch).mock.calls[0]
      expect(url.toString()).toContain('/api/rooms/room-1/messages')
      expect(init?.method).toBe('POST')
    })

    it('returns null on HTTP error', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response('{"error":"not found"}', { status: 404 }))

      const client = createHookClient(MOCK_URL, MOCK_KEY)
      const id = await sendParentMessage(client, 'room-1')

      expect(id).toBeNull()
    })
  })

  describe('sendLogEntry', () => {
    it('posts to /api/rooms/:id/logs with message_id', async () => {
      const mockResponse = { id: 'log-1', room_id: 'room-1', message_id: 'msg-1', sender: 'hook', content: 'Edit: foo.ts', color: '#6b7280', type: 'log', created_at: '2026-01-01T00:00:00Z' }
      vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(mockResponse), { status: 201, headers: { 'Content-Type': 'application/json' } }))

      const client = createHookClient(MOCK_URL, MOCK_KEY)
      await sendLogEntry(client, 'room-1', 'Edit: foo.ts', 'msg-1')

      expect(fetch).toHaveBeenCalledOnce()
      const [url] = vi.mocked(fetch).mock.calls[0]
      expect(url.toString()).toContain('/api/rooms/room-1/logs')
    })

    it('does not throw on HTTP error', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response('{"error":"fail"}', { status: 500 }))

      const client = createHookClient(MOCK_URL, MOCK_KEY)
      await expect(sendLogEntry(client, 'room-1', 'test', 'msg-1')).resolves.not.toThrow()
    })
  })
})
