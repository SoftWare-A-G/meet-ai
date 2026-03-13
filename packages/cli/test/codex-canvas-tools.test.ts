import { describe, expect, it, mock } from 'bun:test'
import type { DynamicToolCallResponse } from '../src/generated/codex-app-server/v2/DynamicToolCallResponse'
import {
  CANVAS_TOOL_SPECS,
  CANVAS_READ_TOOL_NAMES,
  CANVAS_WRITE_TOOL_NAMES,
  createCanvasToolCallHandler,
  type CanvasOperations,
} from '../src/lib/codex-canvas-tools'

// biome-ignore lint: test helper with deliberate any
function getData(result: DynamicToolCallResponse): any {
  const item = result.contentItems[0]
  return JSON.parse('text' in item ? item.text : '')
}

const makeCanvas = () => ({
  id: 'c-1',
  key_id: 'k-1',
  room_id: 'r-1',
  title: null,
  created_at: '2026-03-13',
  updated_at: '2026-03-13',
  last_opened_at: null,
  created_by: null,
  updated_by: null,
})

const makeSnapshot = (records: unknown[] = []) => ({
  canvas_id: 'c-1',
  room_id: 'r-1',
  snapshot: { records },
})

function makeOps(overrides: Partial<CanvasOperations> = {}): CanvasOperations {
  return {
    ensureCanvas: mock(() => Promise.resolve(makeCanvas())),
    getSnapshot: mock(() => Promise.resolve(makeSnapshot([
      { typeName: 'page', id: 'page:page' },
      { typeName: 'shape', id: 'shape:1', type: 'geo', x: 10, y: 20, parentId: 'page:page', index: 'a1' },
      { typeName: 'shape', id: 'shape:2', type: 'note', x: 100, y: 200, parentId: 'page:page', index: 'a2' },
    ]))),
    applyMutations: mock(() => Promise.resolve({ canvas_id: 'c-1', room_id: 'r-1', ok: true })),
    ...overrides,
  }
}

describe('CANVAS_TOOL_SPECS', () => {
  it('defines 8 tools total', () => {
    expect(CANVAS_TOOL_SPECS).toHaveLength(8)
  })

  it('has 3 read tools and 5 write tools', () => {
    expect(CANVAS_READ_TOOL_NAMES.size).toBe(3)
    expect(CANVAS_WRITE_TOOL_NAMES.size).toBe(5)
  })

  it('all specs have name, description, and inputSchema', () => {
    for (const spec of CANVAS_TOOL_SPECS) {
      expect(spec.name).toBeTruthy()
      expect(spec.description).toBeTruthy()
      expect(spec.inputSchema).toBeTruthy()
    }
  })

  it('read tools include get_canvas_state, list_canvas_shapes, get_canvas_snapshot', () => {
    expect(CANVAS_READ_TOOL_NAMES.has('get_canvas_state')).toBe(true)
    expect(CANVAS_READ_TOOL_NAMES.has('list_canvas_shapes')).toBe(true)
    expect(CANVAS_READ_TOOL_NAMES.has('get_canvas_snapshot')).toBe(true)
  })

  it('write tools include create, update, delete, set_view, add_note', () => {
    expect(CANVAS_WRITE_TOOL_NAMES.has('create_canvas_shapes')).toBe(true)
    expect(CANVAS_WRITE_TOOL_NAMES.has('update_canvas_shapes')).toBe(true)
    expect(CANVAS_WRITE_TOOL_NAMES.has('delete_canvas_shapes')).toBe(true)
    expect(CANVAS_WRITE_TOOL_NAMES.has('set_canvas_view')).toBe(true)
    expect(CANVAS_WRITE_TOOL_NAMES.has('add_canvas_note')).toBe(true)
  })
})

describe('createCanvasToolCallHandler', () => {
  it('returns error for unknown tool', async () => {
    const handler = createCanvasToolCallHandler(makeOps())
    const result = await handler('nonexistent_tool', {})
    expect(result.success).toBe(false)
    const text = getData(result)
    expect(text.error).toContain('Unknown canvas tool')
  })

  describe('get_canvas_state', () => {
    it('returns canvas metadata and shape summary', async () => {
      const ops = makeOps()
      const handler = createCanvasToolCallHandler(ops)
      const result = await handler('get_canvas_state', {})

      expect(result.success).toBe(true)
      const data = getData(result)
      expect(data.canvas_id).toBe('c-1')
      expect(data.room_id).toBe('r-1')
      expect(data.page_count).toBe(1)
      expect(data.shape_count).toBe(2)
    })

    it('returns error when canvas access fails', async () => {
      const ops = makeOps({ ensureCanvas: mock(() => Promise.resolve(null)) })
      const handler = createCanvasToolCallHandler(ops)
      const result = await handler('get_canvas_state', {})
      expect(result.success).toBe(false)
    })
  })

  describe('list_canvas_shapes', () => {
    it('returns all shapes without filter', async () => {
      const handler = createCanvasToolCallHandler(makeOps())
      const result = await handler('list_canvas_shapes', {})

      expect(result.success).toBe(true)
      const data = getData(result)
      expect(data.shapes).toHaveLength(2)
      expect(data.total).toBe(2)
    })

    it('filters by shape_type', async () => {
      const handler = createCanvasToolCallHandler(makeOps())
      const result = await handler('list_canvas_shapes', { shape_type: 'note' })

      expect(result.success).toBe(true)
      const data = getData(result)
      expect(data.shapes).toHaveLength(1)
      expect(data.shapes[0].type).toBe('note')
    })

    it('filters by page_id', async () => {
      const ops = makeOps({
        getSnapshot: mock(() => Promise.resolve(makeSnapshot([
          { typeName: 'page', id: 'page:page1' },
          { typeName: 'page', id: 'page:page2' },
          { typeName: 'shape', id: 'shape:1', type: 'geo', x: 0, y: 0, parentId: 'page:page1', index: 'a1' },
          { typeName: 'shape', id: 'shape:2', type: 'note', x: 0, y: 0, parentId: 'page:page2', index: 'a1' },
          { typeName: 'shape', id: 'shape:3', type: 'geo', x: 0, y: 0, parentId: 'page:page1', index: 'a2' },
        ]))),
      })
      const handler = createCanvasToolCallHandler(ops)
      const result = await handler('list_canvas_shapes', { page_id: 'page:page1' })

      expect(result.success).toBe(true)
      const data = getData(result)
      expect(data.shapes).toHaveLength(2)
      expect(data.shapes.map((s: { id: string }) => s.id)).toEqual(['shape:1', 'shape:3'])
    })

    it('filters by page_id and shape_type together', async () => {
      const ops = makeOps({
        getSnapshot: mock(() => Promise.resolve(makeSnapshot([
          { typeName: 'page', id: 'page:page1' },
          { typeName: 'shape', id: 'shape:1', type: 'geo', x: 0, y: 0, parentId: 'page:page1', index: 'a1' },
          { typeName: 'shape', id: 'shape:2', type: 'note', x: 0, y: 0, parentId: 'page:page1', index: 'a2' },
        ]))),
      })
      const handler = createCanvasToolCallHandler(ops)
      const result = await handler('list_canvas_shapes', { page_id: 'page:page1', shape_type: 'note' })

      expect(result.success).toBe(true)
      const data = getData(result)
      expect(data.shapes).toHaveLength(1)
      expect(data.shapes[0].type).toBe('note')
    })

    it('returns error when snapshot fails', async () => {
      const ops = makeOps({ getSnapshot: mock(() => Promise.resolve(null)) })
      const handler = createCanvasToolCallHandler(ops)
      const result = await handler('list_canvas_shapes', {})
      expect(result.success).toBe(false)
    })
  })

  describe('get_canvas_snapshot', () => {
    it('returns raw tldraw document snapshot', async () => {
      const handler = createCanvasToolCallHandler(makeOps())
      const result = await handler('get_canvas_snapshot', {})

      expect(result.success).toBe(true)
      const data = getData(result)
      expect(data.canvas_id).toBe('c-1')
      expect(data.data).toBeTruthy()
      expect(data.data.records).toHaveLength(3)
    })

    it('returns error when snapshot fails', async () => {
      const ops = makeOps({ getSnapshot: mock(() => Promise.resolve(null)) })
      const handler = createCanvasToolCallHandler(ops)
      const result = await handler('get_canvas_snapshot', {})
      expect(result.success).toBe(false)
    })
  })

  describe('create_canvas_shapes', () => {
    it('creates shapes via mutations', async () => {
      const ops = makeOps()
      const handler = createCanvasToolCallHandler(ops)
      const shapes = [{ id: 'shape:new1', type: 'geo' }]
      const result = await handler('create_canvas_shapes', { shapes })

      expect(result.success).toBe(true)
      const data = getData(result)
      expect(data.created_shape_ids).toEqual(['shape:new1'])
      expect(data.ok).toBe(true)
      expect(ops.applyMutations).toHaveBeenCalledWith({ puts: shapes })
    })

    it('rejects empty shapes array', async () => {
      const handler = createCanvasToolCallHandler(makeOps())
      const result = await handler('create_canvas_shapes', { shapes: [] })
      expect(result.success).toBe(false)
    })

    it('returns error when mutation fails', async () => {
      const ops = makeOps({ applyMutations: mock(() => Promise.resolve(null)) })
      const handler = createCanvasToolCallHandler(ops)
      const result = await handler('create_canvas_shapes', { shapes: [{ id: 's:1', type: 'geo' }] })
      expect(result.success).toBe(false)
    })
  })

  describe('update_canvas_shapes', () => {
    it('updates shapes via mutations', async () => {
      const ops = makeOps()
      const handler = createCanvasToolCallHandler(ops)
      const updates = [{ id: 'shape:1', props: { color: 'red' } }]
      const result = await handler('update_canvas_shapes', { updates })

      expect(result.success).toBe(true)
      const data = getData(result)
      expect(data.updated_shape_ids).toEqual(['shape:1'])
      expect(ops.applyMutations).toHaveBeenCalledWith({ puts: updates })
    })
  })

  describe('delete_canvas_shapes', () => {
    it('deletes shapes via mutations', async () => {
      const ops = makeOps()
      const handler = createCanvasToolCallHandler(ops)
      const result = await handler('delete_canvas_shapes', { shape_ids: ['shape:1', 'shape:2'] })

      expect(result.success).toBe(true)
      const data = getData(result)
      expect(data.deleted_shape_ids).toEqual(['shape:1', 'shape:2'])
      expect(ops.applyMutations).toHaveBeenCalledWith({ deletes: ['shape:1', 'shape:2'] })
    })

    it('rejects empty shape_ids', async () => {
      const handler = createCanvasToolCallHandler(makeOps())
      const result = await handler('delete_canvas_shapes', { shape_ids: [] })
      expect(result.success).toBe(false)
    })
  })

  describe('set_canvas_view', () => {
    it('acknowledges viewport parameters', async () => {
      const handler = createCanvasToolCallHandler(makeOps())
      const result = await handler('set_canvas_view', { x: 100, y: 200, zoom: 1.5 })

      expect(result.success).toBe(true)
      const data = getData(result)
      expect(data.ok).toBe(true)
      expect(data.view.x).toBe(100)
      expect(data.view.y).toBe(200)
      expect(data.view.zoom).toBe(1.5)
    })
  })

  describe('add_canvas_note', () => {
    it('creates a note shape with discovered page ID and computed index', async () => {
      const ops = makeOps()
      const handler = createCanvasToolCallHandler(ops)
      const result = await handler('add_canvas_note', { text: 'Hello world', x: 50, y: 50 })

      expect(result.success).toBe(true)
      const data = getData(result)
      expect(data.created_shape_ids).toHaveLength(1)
      expect(data.created_shape_ids[0]).toMatch(/^shape:note_/)

      // Verify the mutation was called with a note shape
      const callArgs = (ops.applyMutations as ReturnType<typeof mock>).mock.calls[0]
      const puts = callArgs[0].puts
      expect(puts).toHaveLength(1)
      expect(puts[0].type).toBe('note')
      expect(puts[0].props.text).toBe('Hello world')
      expect(puts[0].x).toBe(50)
      expect(puts[0].y).toBe(50)
      // parentId should come from snapshot page, not hardcoded
      expect(puts[0].parentId).toBe('page:page')
      // index should be computed from existing shapes (a1, a2 exist → a2V)
      expect(puts[0].index).toBe('a2V')
    })

    it('uses discovered page ID from snapshot', async () => {
      const ops = makeOps({
        getSnapshot: mock(() => Promise.resolve(makeSnapshot([
          { typeName: 'page', id: 'page:custom-page' },
          { typeName: 'shape', id: 'shape:1', type: 'geo', x: 0, y: 0, parentId: 'page:custom-page', index: 'a1' },
        ]))),
      })
      const handler = createCanvasToolCallHandler(ops)
      const result = await handler('add_canvas_note', { text: 'Test', x: 0, y: 0 })

      expect(result.success).toBe(true)
      const callArgs = (ops.applyMutations as ReturnType<typeof mock>).mock.calls[0]
      const puts = callArgs[0].puts
      expect(puts[0].parentId).toBe('page:custom-page')
      expect(puts[0].index).toBe('a1V')
    })

    it('uses default index a1 when no shapes exist on page', async () => {
      const ops = makeOps({
        getSnapshot: mock(() => Promise.resolve(makeSnapshot([
          { typeName: 'page', id: 'page:empty' },
        ]))),
      })
      const handler = createCanvasToolCallHandler(ops)
      const result = await handler('add_canvas_note', { text: 'First note' })

      expect(result.success).toBe(true)
      const callArgs = (ops.applyMutations as ReturnType<typeof mock>).mock.calls[0]
      const puts = callArgs[0].puts
      expect(puts[0].parentId).toBe('page:empty')
      expect(puts[0].index).toBe('a1')
    })

    it('rejects empty text', async () => {
      const handler = createCanvasToolCallHandler(makeOps())
      const result = await handler('add_canvas_note', { text: '' })
      expect(result.success).toBe(false)
    })
  })

  describe('permission review', () => {
    it('blocks write tool when permission is denied', async () => {
      const ops = makeOps({
        requestPermission: mock(() => Promise.resolve({ status: 'denied' as const, feedback: 'Not now' })),
      })
      const handler = createCanvasToolCallHandler(ops)
      const result = await handler('create_canvas_shapes', { shapes: [{ id: 's:1', type: 'geo' }] })

      expect(result.success).toBe(false)
      const data = getData(result)
      expect(data.error).toContain('Permission denied')
      expect(data.error).toContain('Not now')
      // Mutation should NOT have been called
      expect(ops.applyMutations).not.toHaveBeenCalled()
    })

    it('blocks write tool when permission expires', async () => {
      const ops = makeOps({
        requestPermission: mock(() => Promise.resolve({ status: 'expired' as const })),
      })
      const handler = createCanvasToolCallHandler(ops)
      const result = await handler('delete_canvas_shapes', { shape_ids: ['s:1'] })

      expect(result.success).toBe(false)
      expect(ops.applyMutations).not.toHaveBeenCalled()
    })

    it('allows write tool when permission is approved', async () => {
      const ops = makeOps({
        requestPermission: mock(() => Promise.resolve({ status: 'approved' as const })),
      })
      const handler = createCanvasToolCallHandler(ops)
      const result = await handler('create_canvas_shapes', { shapes: [{ id: 's:1', type: 'geo' }] })

      expect(result.success).toBe(true)
      expect(ops.applyMutations).toHaveBeenCalled()
    })

    it('allows write tool when requestPermission returns null (unavailable)', async () => {
      const ops = makeOps({
        requestPermission: mock(() => Promise.resolve(null)),
      })
      const handler = createCanvasToolCallHandler(ops)
      const result = await handler('create_canvas_shapes', { shapes: [{ id: 's:1', type: 'geo' }] })

      // null = reviewer unavailable, block the action
      expect(result.success).toBe(false)
    })

    it('does not request permission for read tools', async () => {
      const reviewer = mock(() => Promise.resolve({ status: 'approved' as const }))
      const ops = makeOps({ requestPermission: reviewer })
      const handler = createCanvasToolCallHandler(ops)

      await handler('get_canvas_state', {})
      await handler('list_canvas_shapes', {})
      await handler('get_canvas_snapshot', {})

      expect(reviewer).not.toHaveBeenCalled()
    })

    it('skips permission review when requestPermission is not provided', async () => {
      const ops = makeOps() // no requestPermission
      const handler = createCanvasToolCallHandler(ops)
      const result = await handler('create_canvas_shapes', { shapes: [{ id: 's:1', type: 'geo' }] })

      // Without requestPermission, write tools execute directly
      expect(result.success).toBe(true)
    })
  })
})
