import { describe, expect, it, mock, beforeEach, afterEach } from 'bun:test'
import { mkdirSync, rmSync } from 'node:fs'
import { setMeetAiDirOverride, writeHomeConfig } from '@meet-ai/cli/lib/meetai-home'

const TEMP_MEET_AI_DIR = '/tmp/meet-ai-canvas-test-home'

const originalFetch = globalThis.fetch

describe('canvas hook wrappers', () => {
  let mockFetch: ReturnType<typeof mock>

  beforeEach(() => {
    rmSync(TEMP_MEET_AI_DIR, { recursive: true, force: true })
    mkdirSync(TEMP_MEET_AI_DIR, { recursive: true })
    mockFetch = mock()
    globalThis.fetch = mockFetch as unknown as typeof fetch
    setMeetAiDirOverride(TEMP_MEET_AI_DIR)
    writeHomeConfig({
      defaultEnv: 'default',
      envs: { default: { url: 'http://localhost:9999', key: 'mai_test123' } },
    })
  })

  afterEach(() => {
    rmSync(TEMP_MEET_AI_DIR, { recursive: true, force: true })
    globalThis.fetch = originalFetch
    setMeetAiDirOverride(undefined)
  })

  it('ensureCanvas returns canvas on success', async () => {
    const { ensureCanvas } = await import('../../src/lib/hooks/canvas')
    const { createHookClient } = await import('../../src/lib/hooks/client')
    const client = createHookClient('http://localhost:9999', 'mai_test123')

    const canvasData = {
      id: 'c-1', key_id: 'k-1', room_id: 'r-1', title: null,
      created_at: '2026-03-13', updated_at: '2026-03-13',
      last_opened_at: null, created_by: null, updated_by: null,
    }
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(canvasData), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const result = await ensureCanvas(client, 'r-1')
    expect(result).toEqual(canvasData)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('ensureCanvas returns null on error', async () => {
    const { ensureCanvas } = await import('../../src/lib/hooks/canvas')
    const { createHookClient } = await import('../../src/lib/hooks/client')
    const client = createHookClient('http://localhost:9999', 'mai_test123')

    mockFetch.mockResolvedValueOnce(new Response('Not Found', { status: 404 }))

    const result = await ensureCanvas(client, 'r-1')
    expect(result).toBeNull()
  })

  it('ensureCanvas returns null on network error', async () => {
    const { ensureCanvas } = await import('../../src/lib/hooks/canvas')
    const { createHookClient } = await import('../../src/lib/hooks/client')
    const client = createHookClient('http://localhost:9999', 'mai_test123')

    mockFetch.mockRejectedValueOnce(new Error('Network failure'))

    const result = await ensureCanvas(client, 'r-1')
    expect(result).toBeNull()
  })

  it('getCanvasSnapshot returns snapshot on success', async () => {
    const { getCanvasSnapshot } = await import('../../src/lib/hooks/canvas')
    const { createHookClient } = await import('../../src/lib/hooks/client')
    const client = createHookClient('http://localhost:9999', 'mai_test123')

    const snapshotData = {
      canvas_id: 'c-1',
      room_id: 'r-1',
      snapshot: { records: [{ typeName: 'page', id: 'page:1' }] },
    }
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(snapshotData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const result = await getCanvasSnapshot(client, 'r-1')
    expect(result).toEqual(snapshotData)
  })

  it('applyCanvasMutations returns result on success', async () => {
    const { applyCanvasMutations } = await import('../../src/lib/hooks/canvas')
    const { createHookClient } = await import('../../src/lib/hooks/client')
    const client = createHookClient('http://localhost:9999', 'mai_test123')

    const mutationResult = { canvas_id: 'c-1', room_id: 'r-1', ok: true }
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(mutationResult), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const result = await applyCanvasMutations(client, 'r-1', {
      puts: [{ id: 'shape:1', type: 'geo' }],
    })
    expect(result).toEqual(mutationResult)
  })

  it('applyCanvasMutations returns null on failure', async () => {
    const { applyCanvasMutations } = await import('../../src/lib/hooks/canvas')
    const { createHookClient } = await import('../../src/lib/hooks/client')
    const client = createHookClient('http://localhost:9999', 'mai_test123')

    mockFetch.mockResolvedValueOnce(new Response('Error', { status: 500 }))

    const result = await applyCanvasMutations(client, 'r-1', { deletes: ['shape:1'] })
    expect(result).toBeNull()
  })
})
