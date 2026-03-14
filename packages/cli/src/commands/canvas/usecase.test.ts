import { describe, expect, it, mock } from 'bun:test'
import {
  invokeCanvasTool,
  listBuiltInShapeTypes,
  listCanvasTools,
} from './usecase'

describe('invokeCanvasTool', () => {
  it('invokes the shared canvas runner with home-config credentials', async () => {
    const ensureCanvasMock = mock(() =>
      Promise.resolve({
        id: 'c-1',
        key_id: 'k-1',
        room_id: 'room-1',
        title: null,
        created_at: '2026-03-13',
        updated_at: '2026-03-13',
        last_opened_at: null,
        created_by: null,
        updated_by: null,
      })
    )
    const getCanvasSnapshotMock = mock(() =>
      Promise.resolve({
        canvas_id: 'c-1',
        room_id: 'room-1',
        snapshot: {
          records: [
            { typeName: 'page', id: 'page:page' },
            { typeName: 'shape', id: 'shape:1', type: 'geo', parentId: 'page:page', index: 'a1', x: 0, y: 0 },
          ],
        },
      })
    )
    const applyCanvasMutationsMock = mock(() =>
      Promise.resolve({
        canvas_id: 'c-1',
        room_id: 'room-1',
        ok: true,
      })
    )
    const createHookClientMock = mock(() => ({ api: {} }))

    const result = await invokeCanvasTool(
      {
        roomId: 'room-1',
        tool: 'delete_canvas_shapes',
        args: { shape_ids: ['shape:1'] },
      },
      {
        createHookClient: createHookClientMock as never,
        getHomeCredentials: () => ({ url: 'https://meet-ai.test', key: 'secret' }),
        ensureCanvas: ensureCanvasMock as never,
        getCanvasSnapshot: getCanvasSnapshotMock as never,
        applyCanvasMutations: applyCanvasMutationsMock as never,
      }
    )

    expect(result.deleted_shape_ids).toEqual(['shape:1'])
    expect(createHookClientMock).toHaveBeenCalledWith('https://meet-ai.test', 'secret')
    expect(applyCanvasMutationsMock).toHaveBeenCalledWith(expect.anything(), 'room-1', {
      deletes: ['shape:1'],
    })
  })
})

describe('canvas metadata helpers', () => {
  it('lists tool metadata for the shared canvas surface', () => {
    const tools = listCanvasTools()
    expect(tools.some(tool => tool.name === 'create_canvas_shapes')).toBe(true)
    expect(tools.some(tool => tool.name === 'add_canvas_note')).toBe(true)
  })

  it('lists built-in tldraw shape types', () => {
    expect(listBuiltInShapeTypes()).toEqual([
      'text',
      'draw',
      'geo',
      'note',
      'line',
      'frame',
      'arrow',
      'highlight',
    ])
  })
})
