import { describe, expect, it, mock } from 'bun:test'
import { b64Vecs } from 'tldraw'
import type { DynamicToolCallResponse } from '../src/generated/codex-app-server/v2/DynamicToolCallResponse'
import {
  BUILTIN_TLDRAW_SHAPE_TYPES,
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

const makeGeoRecord = (overrides: Record<string, unknown> = {}) => ({
  id: 'shape:geo',
  typeName: 'shape',
  type: 'geo',
  x: 0,
  y: 0,
  rotation: 0,
  parentId: 'page:page',
  index: 'a1',
  isLocked: false,
  opacity: 1,
  meta: {},
  props: {
    geo: 'rectangle',
    dash: 'draw',
    url: '',
    w: 100,
    h: 100,
    growY: 0,
    scale: 1,
    labelColor: 'black',
    color: 'black',
    fill: 'none',
    size: 'm',
    font: 'draw',
    align: 'middle',
    verticalAlign: 'middle',
    richText: { type: 'doc', content: [{ type: 'paragraph' }] },
  },
  ...overrides,
})

const makeNoteRecord = (overrides: Record<string, unknown> = {}) => ({
  id: 'shape:note',
  typeName: 'shape',
  type: 'note',
  x: 100,
  y: 200,
  rotation: 0,
  parentId: 'page:page',
  index: 'a2',
  isLocked: false,
  opacity: 1,
  meta: {},
  props: {
    color: 'black',
    labelColor: 'black',
    size: 'm',
    font: 'draw',
    fontSizeAdjustment: 0,
    align: 'middle',
    verticalAlign: 'middle',
    growY: 0,
    url: '',
    richText: { type: 'doc', content: [{ type: 'paragraph' }] },
    scale: 1,
  },
  ...overrides,
})

function makeOps(overrides: Partial<CanvasOperations> = {}): CanvasOperations {
  return {
    ensureCanvas: mock(() => Promise.resolve(makeCanvas())),
    getSnapshot: mock(() => Promise.resolve(makeSnapshot([
      { typeName: 'page', id: 'page:page' },
      makeGeoRecord({ id: 'shape:1', x: 10, y: 20 }),
      makeNoteRecord({ id: 'shape:2' }),
    ]))),
    applyMutations: mock(() => Promise.resolve({ canvas_id: 'c-1', room_id: 'r-1', ok: true })),
    ...overrides,
  }
}

describe('CANVAS_TOOL_SPECS', () => {
  it('defines 9 tools total', () => {
    expect(CANVAS_TOOL_SPECS).toHaveLength(9)
  })

  it('has 4 read tools and 5 write tools', () => {
    expect(CANVAS_READ_TOOL_NAMES.size).toBe(4)
    expect(CANVAS_WRITE_TOOL_NAMES.size).toBe(5)
  })

  it('all specs have name, description, and inputSchema', () => {
    for (const spec of CANVAS_TOOL_SPECS) {
      expect(spec.name).toBeTruthy()
      expect(spec.description).toBeTruthy()
      expect(spec.inputSchema).toBeTruthy()
    }
  })

  it('read tools include get_canvas_state, list_canvas_shape_types, list_canvas_shapes, get_canvas_snapshot', () => {
    expect(CANVAS_READ_TOOL_NAMES.has('get_canvas_state')).toBe(true)
    expect(CANVAS_READ_TOOL_NAMES.has('list_canvas_shape_types')).toBe(true)
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

  it('advertises only the storage-free shape subset', () => {
    expect(BUILTIN_TLDRAW_SHAPE_TYPES).toEqual([
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

  describe('list_canvas_shape_types', () => {
    it('returns only the storage-free shape subset', async () => {
      const handler = createCanvasToolCallHandler(makeOps())
      const result = await handler('list_canvas_shape_types', {})

      expect(result.success).toBe(true)
      const data = getData(result)
      expect(data.shape_types).toEqual(BUILTIN_TLDRAW_SHAPE_TYPES)
      expect(data.total).toBe(BUILTIN_TLDRAW_SHAPE_TYPES.length)
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
    it('normalizes simplified shapes into full tldraw records before mutations', async () => {
      const ops = makeOps()
      const handler = createCanvasToolCallHandler(ops)
      const shapes = [{ id: 'shape:new1', type: 'geo', x: 120, y: 140, props: { w: 240, h: 140, fill: 'semi' } }]
      const result = await handler('create_canvas_shapes', { shapes })

      expect(result.success).toBe(true)
      const data = getData(result)
      expect(data.created_shape_ids).toEqual(['shape:new1'])
      expect(data.ok).toBe(true)
      const callArgs = (ops.applyMutations as ReturnType<typeof mock>).mock.calls[0]
      const puts = callArgs[0].puts
      expect(puts).toHaveLength(1)
      expect(puts[0].id).toBe('shape:new1')
      expect(puts[0].typeName).toBe('shape')
      expect(puts[0].type).toBe('geo')
      expect(puts[0].parentId).toBe('page:page')
      expect(typeof puts[0].index).toBe('string')
      expect(puts[0].x).toBe(120)
      expect(puts[0].y).toBe(140)
      expect(puts[0].rotation).toBe(0)
      expect(puts[0].isLocked).toBe(false)
      expect(puts[0].opacity).toBe(1)
      expect(puts[0].meta).toEqual({})
      expect(puts[0].props.geo).toBe('rectangle')
      expect(puts[0].props.w).toBe(240)
      expect(puts[0].props.h).toBe(140)
      expect(puts[0].props.fill).toBe('semi')
      expect(puts[0].props.scale).toBe(1)
      expect(puts[0].props.richText).toEqual({
        type: 'doc',
        content: [{ type: 'paragraph' }],
      })
      expect(puts[0].props.text).toBeUndefined()
    })

    it('assigns sequential indexes when creating multiple shapes together', async () => {
      const ops = makeOps()
      const handler = createCanvasToolCallHandler(ops)
      const shapes = [
        { id: 'shape:new1', type: 'geo' },
        { id: 'shape:new2', type: 'geo' },
      ]
      const result = await handler('create_canvas_shapes', { shapes })

      expect(result.success).toBe(true)
      const callArgs = (ops.applyMutations as ReturnType<typeof mock>).mock.calls[0]
      const puts = callArgs[0].puts
      expect(typeof puts[0].index).toBe('string')
      expect(typeof puts[1].index).toBe('string')
      expect(puts[0].index).not.toBe(puts[1].index)
      expect([puts[0].index, puts[1].index]).toEqual([...puts].map((shape: { index: string }) => shape.index).sort())
      expect(puts[0].props.w).toBe(100)
      expect(puts[0].props.h).toBe(100)
      expect(puts[0].props.dash).toBe('draw')
      expect(puts[0].props.scale).toBe(1)
      expect(puts[0].props.richText).toEqual({
        type: 'doc',
        content: [{ type: 'paragraph' }],
      })
    })

    it('rejects empty shapes array', async () => {
      const handler = createCanvasToolCallHandler(makeOps())
      const result = await handler('create_canvas_shapes', { shapes: [] })
      expect(result.success).toBe(false)
    })

    it('returns error when mutation fails', async () => {
      const ops = makeOps({ applyMutations: mock(() => Promise.resolve(null)) })
      const handler = createCanvasToolCallHandler(ops)
      const result = await handler('create_canvas_shapes', { shapes: [{ id: 'shape:s1', type: 'geo' }] })
      expect(result.success).toBe(false)
    })

    it('hydrates video shapes with shipped autoplay defaults', async () => {
      const ops = makeOps()
      const handler = createCanvasToolCallHandler(ops)
      const result = await handler('create_canvas_shapes', {
        shapes: [{ id: 'shape:video1', type: 'video', props: { url: 'https://example.com/video.mp4' } }],
      })

      expect(result.success).toBe(true)
      const callArgs = (ops.applyMutations as ReturnType<typeof mock>).mock.calls[0]
      const puts = callArgs[0].puts
      expect(puts).toHaveLength(1)
      expect(puts[0].type).toBe('video')
      expect(puts[0].props.autoplay).toBe(true)
      expect(puts[0].props.url).toBe('https://example.com/video.mp4')
      expect(puts[0].props.assetId).toBeNull()
      expect(puts[0].props.playing).toBe(true)
    })

    it('creates draw shapes with an initial encoded point instead of empty segments', async () => {
      const ops = makeOps()
      const handler = createCanvasToolCallHandler(ops)
      const result = await handler('create_canvas_shapes', {
        shapes: [{ id: 'shape:draw1', type: 'draw' }],
      })

      expect(result.success).toBe(true)
      const callArgs = (ops.applyMutations as ReturnType<typeof mock>).mock.calls[0]
      const puts = callArgs[0].puts
      expect(puts).toHaveLength(1)
      expect(puts[0].type).toBe('draw')
      expect(puts[0].props.segments).toHaveLength(1)
      expect(puts[0].props.segments[0].type).toBe('free')
      expect(b64Vecs.decodePoints(puts[0].props.segments[0].path)).toEqual([{ x: 0, y: 0, z: 0.5 }])
    })

    it('creates highlight shapes with an initial encoded point instead of empty segments', async () => {
      const ops = makeOps()
      const handler = createCanvasToolCallHandler(ops)
      const result = await handler('create_canvas_shapes', {
        shapes: [{ id: 'shape:highlight1', type: 'highlight' }],
      })

      expect(result.success).toBe(true)
      const callArgs = (ops.applyMutations as ReturnType<typeof mock>).mock.calls[0]
      const puts = callArgs[0].puts
      expect(puts).toHaveLength(1)
      expect(puts[0].type).toBe('highlight')
      expect(puts[0].props.segments).toHaveLength(1)
      expect(puts[0].props.segments[0].type).toBe('free')
      expect(b64Vecs.decodePoints(puts[0].props.segments[0].path)).toEqual([{ x: 0, y: 0, z: 0.5 }])
    })

    it('repairs degenerate line points the same way tldraw onBeforeCreate does', async () => {
      const ops = makeOps()
      const handler = createCanvasToolCallHandler(ops)
      const result = await handler('create_canvas_shapes', {
        shapes: [{
          id: 'shape:line1',
          type: 'line',
          props: {
            points: {
              a1: { id: 'a1', index: 'a1', x: 10, y: 10 },
              a2: { id: 'a2', index: 'a2', x: 10, y: 10 },
            },
          },
        }],
      })

      expect(result.success).toBe(true)
      const callArgs = (ops.applyMutations as ReturnType<typeof mock>).mock.calls[0]
      const puts = callArgs[0].puts
      expect(puts).toHaveLength(1)
      expect(puts[0].type).toBe('line')
      expect(puts[0].props.points.a1).toMatchObject({ x: 10, y: 10 })
      expect(puts[0].props.points.a2).toMatchObject({ x: 10.1, y: 10.1 })
    })
  })

  describe('update_canvas_shapes', () => {
    it('hydrates partial updates from the existing canvas record before mutations', async () => {
      const ops = makeOps()
      const handler = createCanvasToolCallHandler(ops)
      const updates = [{ id: 'shape:1', props: { color: 'red' } }]
      const result = await handler('update_canvas_shapes', { updates })

      expect(result.success).toBe(true)
      const data = getData(result)
      expect(data.updated_shape_ids).toEqual(['shape:1'])
      const callArgs = (ops.applyMutations as ReturnType<typeof mock>).mock.calls[0]
      const puts = callArgs[0].puts
      expect(puts).toHaveLength(1)
      expect(puts[0].id).toBe('shape:1')
      expect(puts[0].typeName).toBe('shape')
      expect(puts[0].type).toBe('geo')
      expect(puts[0].x).toBe(10)
      expect(puts[0].y).toBe(20)
      expect(puts[0].parentId).toBe('page:page')
      expect(puts[0].index).toBe('a1')
      expect(puts[0].props.color).toBe('red')
    })

    it('returns an error when the target shape does not exist', async () => {
      const ops = makeOps()
      const handler = createCanvasToolCallHandler(ops)
      const result = await handler('update_canvas_shapes', { updates: [{ id: 'shape:missing', props: { color: 'red' } }] })

      expect(result.success).toBe(false)
      expect(ops.applyMutations).not.toHaveBeenCalled()
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
      expect(data.created_shape_ids[0]).toMatch(/^shape:/)

      // Verify the mutation was called with a note shape
      const callArgs = (ops.applyMutations as ReturnType<typeof mock>).mock.calls[0]
      const puts = callArgs[0].puts
      expect(puts).toHaveLength(1)
      expect(puts[0].type).toBe('note')
      expect(puts[0].props.color).toBe('black')
      expect(puts[0].props.scale).toBe(1)
      expect(puts[0].props.labelColor).toBe('black')
      expect(puts[0].props.richText).toEqual({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] }],
      })
      expect(puts[0].props.text).toBeUndefined()
      expect(puts[0].x).toBe(50)
      expect(puts[0].y).toBe(50)
      expect(puts[0].opacity).toBe(1)
      // parentId should come from snapshot page, not hardcoded
      expect(puts[0].parentId).toBe('page:page')
      expect(typeof puts[0].index).toBe('string')
    })

    it('uses discovered page ID from snapshot', async () => {
      const ops = makeOps({
        getSnapshot: mock(() => Promise.resolve(makeSnapshot([
          { typeName: 'page', id: 'page:custom-page' },
          makeGeoRecord({ id: 'shape:1', parentId: 'page:custom-page' }),
        ]))),
      })
      const handler = createCanvasToolCallHandler(ops)
      const result = await handler('add_canvas_note', { text: 'Test', x: 0, y: 0 })

      expect(result.success).toBe(true)
      const callArgs = (ops.applyMutations as ReturnType<typeof mock>).mock.calls[0]
      const puts = callArgs[0].puts
      expect(puts[0].parentId).toBe('page:custom-page')
      expect(typeof puts[0].index).toBe('string')
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
      expect(typeof puts[0].index).toBe('string')
      expect(puts[0].index.length).toBeGreaterThan(0)
    })

    it('rejects empty text', async () => {
      const handler = createCanvasToolCallHandler(makeOps())
      const result = await handler('add_canvas_note', { text: '' })
      expect(result.success).toBe(false)
    })
  })

  describe('write execution', () => {
    it('executes write tools directly without permission review', async () => {
      const reviewer = mock(() => Promise.resolve({ status: 'denied' as const, feedback: 'Not now' }))
      const ops = makeOps({
        // Legacy fixtures may still pass this through; it is ignored now.
        requestPermission: reviewer,
      } as Partial<CanvasOperations>)
      const handler = createCanvasToolCallHandler(ops)
      const result = await handler('create_canvas_shapes', { shapes: [{ id: 'shape:s1', type: 'geo' }] })

      expect(result.success).toBe(true)
      expect(ops.applyMutations).toHaveBeenCalled()
      expect(reviewer.mock.calls).toHaveLength(0)
    })
  })
})
