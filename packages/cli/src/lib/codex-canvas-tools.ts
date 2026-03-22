import { createTLSchema, toRichText, type TLRecord } from '@tldraw/tlschema'
import { b64Vecs, createShapeId, defaultShapeUtils, getIndexAbove } from 'tldraw'
import { z } from 'zod'
import { makeToolResponse, makeToolError } from './codex-task-tools'
import type { DynamicToolCallHandler } from './codex-app-server'
import type { Canvas, CanvasSnapshot, CanvasMutationResult } from './hooks/canvas'
import type { DynamicToolCallResponse } from '@meet-ai/cli/generated/codex-app-server/v2/DynamicToolCallResponse'
import type { DynamicToolSpec } from '@meet-ai/cli/generated/codex-app-server/v2/DynamicToolSpec'

// --- Zod input schemas ---

export const GetCanvasStateInput = z.object({})
export const ListCanvasShapeTypesInput = z.object({})

export const ListCanvasShapesInput = z.object({
  page_id: z.string().optional(),
  shape_type: z.string().optional(),
})

export const GetCanvasSnapshotInput = z.object({})

export const CreateCanvasShapesInput = z.object({
  shapes: z.array(z.record(z.string(), z.unknown()).and(z.object({ id: z.string() }))).min(1),
})

export const UpdateCanvasShapesInput = z.object({
  updates: z.array(z.record(z.string(), z.unknown()).and(z.object({ id: z.string() }))).min(1),
})

export const DeleteCanvasShapesInput = z.object({
  shape_ids: z.array(z.string().min(1)).min(1),
})

export const SetCanvasViewInput = z.object({
  focus_shape_ids: z.array(z.string()).optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  zoom: z.number().optional(),
})

export const AddCanvasNoteInput = z.object({
  text: z.string().min(1).max(5000),
  x: z.number().optional(),
  y: z.number().optional(),
})

// --- JSON Schema representations ---

const getCanvasStateJsonSchema = {
  type: 'object',
  properties: {},
  additionalProperties: false,
}

const listCanvasShapeTypesJsonSchema = {
  type: 'object',
  properties: {},
  additionalProperties: false,
}

const listCanvasShapesJsonSchema = {
  type: 'object',
  properties: {
    page_id: { type: 'string', description: 'Filter shapes by page ID' },
    shape_type: {
      type: 'string',
      description: 'Filter shapes by type (e.g. "geo", "arrow", "text", "note")',
    },
  },
  additionalProperties: false,
}

const getCanvasSnapshotJsonSchema = {
  type: 'object',
  properties: {},
  additionalProperties: false,
}

const createCanvasShapesJsonSchema = {
  type: 'object',
  properties: {
    shapes: {
      type: 'array',
      description: 'Array of tldraw shape objects to create. Each must have an "id" field.',
      items: { type: 'object' },
      minItems: 1,
    },
  },
  required: ['shapes'],
  additionalProperties: false,
}

const updateCanvasShapesJsonSchema = {
  type: 'object',
  properties: {
    updates: {
      type: 'array',
      description: 'Array of partial tldraw shape objects to update. Each must have an "id" field.',
      items: { type: 'object' },
      minItems: 1,
    },
  },
  required: ['updates'],
  additionalProperties: false,
}

const deleteCanvasShapesJsonSchema = {
  type: 'object',
  properties: {
    shape_ids: {
      type: 'array',
      description: 'Array of shape IDs to delete',
      items: { type: 'string' },
      minItems: 1,
    },
  },
  required: ['shape_ids'],
  additionalProperties: false,
}

const setCanvasViewJsonSchema = {
  type: 'object',
  properties: {
    focus_shape_ids: {
      type: 'array',
      description: 'Shape IDs to focus the viewport on',
      items: { type: 'string' },
    },
    x: { type: 'number', description: 'Viewport center X coordinate' },
    y: { type: 'number', description: 'Viewport center Y coordinate' },
    zoom: { type: 'number', description: 'Viewport zoom level (1 = 100%)' },
  },
  additionalProperties: false,
}

const addCanvasNoteJsonSchema = {
  type: 'object',
  properties: {
    text: {
      type: 'string',
      description: 'Note text content (1-5000 chars)',
      minLength: 1,
      maxLength: 5000,
    },
    x: { type: 'number', description: 'X position on canvas' },
    y: { type: 'number', description: 'Y position on canvas' },
  },
  required: ['text'],
  additionalProperties: false,
}

// --- DynamicToolSpec definitions ---

const STORAGE_FREE_SHAPE_TYPES = new Set([
  'text',
  'draw',
  'geo',
  'note',
  'line',
  'frame',
  'arrow',
  'highlight',
])
export const BUILTIN_TLDRAW_SHAPE_TYPES = defaultShapeUtils
  .map(util => util.type)
  .filter(type => STORAGE_FREE_SHAPE_TYPES.has(type))
const BUILTIN_SHAPE_DESCRIPTION = BUILTIN_TLDRAW_SHAPE_TYPES.join(', ')
const CANVAS_SCHEMA = createTLSchema()
const SHAPE_RECORD_TYPE = CANVAS_SCHEMA.types.shape
const CREATE_SHAPES_EXAMPLE =
  '{"shapes":[{"id":"shape:box1","type":"geo","x":120,"y":140,"props":{"w":240,"h":140,"geo":"rectangle","fill":"semi"}}]}'
const UPDATE_SHAPES_EXAMPLE =
  '{"updates":[{"id":"shape:box1","x":260,"y":180}]}'
const ADD_NOTE_EXAMPLE = '{"text":"Hello from Meet AI","x":120,"y":120}'

// Read tools — no permission review needed
export const CANVAS_READ_TOOL_SPECS: DynamicToolSpec[] = [
  {
    name: 'get_canvas_state',
    description:
      'Get the current canvas state including metadata, page summary, and shape counts for the room canvas.',
    inputSchema: getCanvasStateJsonSchema,
  },
  {
    name: 'list_canvas_shape_types',
    description:
      'List the storage-free tldraw shape primitives exposed through create_canvas_shapes so agents can discover the supported canvas surface without codebase research.',
    inputSchema: listCanvasShapeTypesJsonSchema,
  },
  {
    name: 'list_canvas_shapes',
    description:
      'List shapes on the room canvas. Optionally filter by page_id or shape_type. Returns shape metadata.',
    inputSchema: listCanvasShapesJsonSchema,
  },
  {
    name: 'get_canvas_snapshot',
    description:
      'Get the raw tldraw document snapshot for the room canvas. Returns the full snapshot including all records (pages, shapes, view state, and metadata).',
    inputSchema: getCanvasSnapshotJsonSchema,
  },
]

// Write tools
export const CANVAS_WRITE_TOOL_SPECS: DynamicToolSpec[] = [
  {
    name: 'create_canvas_shapes',
    description: `Create new shapes on the room canvas. Each shape must have an "id" field. Uses the installed tldraw shape format and supports the storage-free shape subset: ${BUILTIN_SHAPE_DESCRIPTION}. Example input: ${CREATE_SHAPES_EXAMPLE}`,
    inputSchema: createCanvasShapesJsonSchema,
  },
  {
    name: 'update_canvas_shapes',
    description: `Update existing shapes on the room canvas. Each update must have an "id" field identifying the shape to modify. Supports the storage-free shape subset: ${BUILTIN_SHAPE_DESCRIPTION}. Example input: ${UPDATE_SHAPES_EXAMPLE}`,
    inputSchema: updateCanvasShapesJsonSchema,
  },
  {
    name: 'delete_canvas_shapes',
    description: 'Delete shapes from the room canvas by their IDs.',
    inputSchema: deleteCanvasShapesJsonSchema,
  },
  {
    name: 'set_canvas_view',
    description:
      'Set the canvas viewport. Focus on specific shapes or move to specific coordinates with a zoom level.',
    inputSchema: setCanvasViewJsonSchema,
  },
  {
    name: 'add_canvas_note',
    description:
      `Add a text note to the room canvas at the specified position. Creates a tldraw note shape. Example input: ${ADD_NOTE_EXAMPLE}`,
    inputSchema: addCanvasNoteJsonSchema,
  },
]

export const CANVAS_TOOL_SPECS: DynamicToolSpec[] = [
  ...CANVAS_READ_TOOL_SPECS,
  ...CANVAS_WRITE_TOOL_SPECS,
]

export const CANVAS_TOOL_NAMES = new Set(CANVAS_TOOL_SPECS.map(s => s.name))
export const CANVAS_READ_TOOL_NAMES = new Set(CANVAS_READ_TOOL_SPECS.map(s => s.name))
export const CANVAS_WRITE_TOOL_NAMES = new Set(CANVAS_WRITE_TOOL_SPECS.map(s => s.name))
// --- Index utilities ---

/**
 * Compute the next fractional index that sorts after all existing indexes.
 * tldraw uses lexicographic string indexes (e.g. "a1", "a2", "a1V").
 * We find the highest existing index and append "V" to guarantee it sorts after.
 */
function getNextIndex(existingIndexes: string[]): string {
  const sorted = [...existingIndexes].sort()
  const highest = sorted[sorted.length - 1]
  return getIndexAbove(highest as Parameters<typeof getIndexAbove>[0]) as string
}

type CanvasRecord = Record<string, unknown> & { id: string }
type CanvasMutationPut = TLRecord

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isCanvasRecord(value: unknown): value is CanvasRecord {
  return isRecordObject(value) && typeof value.id === 'string'
}

function listSnapshotRecords(snapshot: unknown): CanvasRecord[] {
  if (!isRecordObject(snapshot) || !Array.isArray(snapshot.records)) return []
  return snapshot.records.filter(isCanvasRecord)
}

function getSnapshotContext(snapshot: unknown): {
  pageIds: string[]
  recordById: Map<string, CanvasRecord>
  shapeRecords: CanvasRecord[]
} {
  const records = listSnapshotRecords(snapshot)
  const pageIds = records.filter(record => record.typeName === 'page').map(record => record.id)
  const shapeRecords = records.filter(record => record.typeName === 'shape')
  return {
    pageIds,
    shapeRecords,
    recordById: new Map(records.map(record => [record.id, record])),
  }
}

const DEFAULT_SHAPE_PROPS_BY_TYPE = new Map<string, () => Record<string, unknown>>(
  defaultShapeUtils.map(ShapeUtilCtor => [
    ShapeUtilCtor.type,
    () =>
      new ShapeUtilCtor(undefined as never).getDefaultProps() as unknown as Record<string, unknown>,
  ])
)

function withRichText(
  props: Record<string, unknown>,
  fallbackText = '',
  replaceDefault = false
): Record<string, unknown> {
  const nextProps = { ...props }
  const text = typeof nextProps.text === 'string' ? nextProps.text : fallbackText

  if (replaceDefault || !isRecordObject(nextProps.richText)) {
    nextProps.richText = toRichText(text)
  }

  delete nextProps.text
  return nextProps
}

function isLinePoint(value: unknown): value is {
  id: string
  index: string
  x: number
  y: number
} {
  return (
    isRecordObject(value)
    && typeof value.id === 'string'
    && typeof value.index === 'string'
    && typeof value.x === 'number'
    && typeof value.y === 'number'
  )
}

function createInitialDrawSegments(): { type: 'free'; path: string }[] {
  return [{
    type: 'free',
    path: b64Vecs.encodePoints([{ x: 0, y: 0, z: 0.5 }]),
  }]
}

function normalizeLinePoints(
  points: unknown,
  fallbackPoints: unknown
): Record<string, unknown> | undefined {
  const basePoints = isRecordObject(fallbackPoints) ? fallbackPoints : undefined
  const nextPoints = isRecordObject(points)
    ? {
        ...(basePoints ?? {}),
        ...points,
      }
    : basePoints

  if (!nextPoints) return undefined

  const pointKeys = Object.keys(nextPoints)
  if (pointKeys.length < 2) {
    return nextPoints
  }

  const firstPoint = nextPoints[pointKeys[0]]
  if (!isLinePoint(firstPoint)) {
    return nextPoints
  }

  const allSame = pointKeys.every(key => {
    const point = nextPoints[key]
    return isLinePoint(point) && point.x === firstPoint.x && point.y === firstPoint.y
  })

  if (!allSame) {
    return nextPoints
  }

  const lastKey = pointKeys[pointKeys.length - 1]
  const lastPoint = nextPoints[lastKey]
  if (!isLinePoint(lastPoint)) {
    return nextPoints
  }

  return {
    ...nextPoints,
    [lastKey]: {
      ...lastPoint,
      x: lastPoint.x + 0.1,
      y: lastPoint.y + 0.1,
    },
  }
}

function normalizeShapePropsForCreation(
  type: string,
  props: Record<string, unknown>,
  defaultProps: Record<string, unknown>
): Record<string, unknown> {
  if ((type === 'draw' || type === 'highlight')) {
    const segments = Array.isArray(props.segments) && props.segments.length > 0
      ? props.segments
      : createInitialDrawSegments()

    return {
      ...defaultProps,
      ...props,
      segments,
    }
  }

  if (type === 'line') {
    return {
      ...defaultProps,
      ...props,
      points: normalizeLinePoints(props.points, defaultProps.points),
    }
  }

  return {
    ...defaultProps,
    ...props,
  }
}

function getDefaultShapeProps(
  type: string,
  props: Record<string, unknown>
): Record<string, unknown> {
  const getDefaultProps = DEFAULT_SHAPE_PROPS_BY_TYPE.get(type)
  if (!getDefaultProps) return props

  const defaultProps = getDefaultProps()
  const mergedProps = normalizeShapePropsForCreation(type, props, defaultProps)

  if (!('richText' in defaultProps) && !isRecordObject(props.richText)) {
    return mergedProps
  }

  return withRichText(
    mergedProps,
    typeof props.text === 'string' ? props.text : '',
    !isRecordObject(props.richText)
  )
}

function normalizeCreatedShapeRecords(
  shapes: CanvasRecord[],
  snapshot: unknown
): CanvasMutationPut[] {
  const context = getSnapshotContext(snapshot)
  const defaultPageId = context.pageIds[0] ?? 'page:page'
  const reservedIndexes = new Map<string, string[]>()

  return shapes.map(shape => {
    const parentId = typeof shape.parentId === 'string' ? shape.parentId : defaultPageId
    const existingSiblingIndexes = context.shapeRecords
      .filter(record => record.parentId === parentId && typeof record.index === 'string')
      .map(record => record.index as string)
    const pendingSiblingIndexes = reservedIndexes.get(parentId) ?? []
    const index =
      typeof shape.index === 'string'
        ? shape.index
        : getNextIndex([...existingSiblingIndexes, ...pendingSiblingIndexes])

    reservedIndexes.set(parentId, [...pendingSiblingIndexes, index])

    const type = typeof shape.type === 'string' ? shape.type : 'geo'
    const props = isRecordObject(shape.props) ? shape.props : {}
    const record = SHAPE_RECORD_TYPE.create({
      ...shape,
      id: shape.id,
      type,
      parentId,
      index,
      props: getDefaultShapeProps(type, props),
      meta: isRecordObject(shape.meta) ? shape.meta : {},
    } as Parameters<typeof SHAPE_RECORD_TYPE.create>[0])

    return SHAPE_RECORD_TYPE.validate(record) as CanvasMutationPut
  })
}

function mergeCanvasRecord(existing: CanvasRecord, update: CanvasRecord): CanvasMutationPut {
  const existingProps = isRecordObject(existing.props) ? existing.props : {}
  const updateProps = isRecordObject(update.props) ? update.props : {}
  const existingMeta = isRecordObject(existing.meta) ? existing.meta : {}
  const updateMeta = isRecordObject(update.meta) ? update.meta : {}

  return SHAPE_RECORD_TYPE.validate({
    ...existing,
    ...update,
    typeName:
      typeof update.typeName === 'string'
        ? update.typeName
        : typeof existing.typeName === 'string'
          ? existing.typeName
          : 'shape',
    props: getDefaultShapeProps(
      typeof update.type === 'string' ? update.type : (existing.type as string),
      { ...existingProps, ...updateProps }
    ),
    meta: { ...existingMeta, ...updateMeta },
  }) as CanvasMutationPut
}

// --- Canvas tool call handler ---

export type CanvasOperations = {
  ensureCanvas(): Promise<Canvas | null>
  getSnapshot(): Promise<CanvasSnapshot | null>
  applyMutations(mutations: {
    puts?: CanvasMutationPut[]
    deletes?: string[]
  }): Promise<CanvasMutationResult | null>
}

export type CanvasToolExecutionResult =
  | { success: true; data: Record<string, unknown> }
  | { success: false; error: string }

function summarizeSnapshot(snapshot: unknown): {
  page_count: number
  page_ids: string[]
  shape_count: number
  shapes: {
    id: string
    type: string
    parentId?: string
    index?: string
    x?: number
    y?: number
  }[]
} {
  if (!snapshot || typeof snapshot !== 'object') {
    return { page_count: 0, page_ids: [], shape_count: 0, shapes: [] }
  }

  const records = (snapshot as Record<string, unknown>).records
  if (!Array.isArray(records)) {
    return { page_count: 0, page_ids: [], shape_count: 0, shapes: [] }
  }

  const pageIds: string[] = []
  const shapes: {
    id: string
    type: string
    parentId?: string
    index?: string
    x?: number
    y?: number
  }[] = []

  for (const record of records) {
    if (typeof record !== 'object' || record === null) continue
    const rec = record as Record<string, unknown>
    const typeName = rec.typeName as string | undefined

    if (typeName === 'page') {
      pageIds.push(rec.id as string)
    } else if (typeName === 'shape') {
      shapes.push({
        id: rec.id as string,
        type: rec.type as string,
        parentId: typeof rec.parentId === 'string' ? rec.parentId : undefined,
        index: typeof rec.index === 'string' ? rec.index : undefined,
        x: typeof rec.x === 'number' ? rec.x : undefined,
        y: typeof rec.y === 'number' ? rec.y : undefined,
      })
    }
  }

  return { page_count: pageIds.length, page_ids: pageIds, shape_count: shapes.length, shapes }
}

export async function executeCanvasTool(
  ops: CanvasOperations,
  tool: string,
  args: unknown
): Promise<CanvasToolExecutionResult> {
  if (!CANVAS_TOOL_NAMES.has(tool)) {
    return { success: false, error: `Unknown canvas tool: ${tool}` }
  }

  switch (tool) {
    case 'get_canvas_state': {
      const canvas = await ops.ensureCanvas()
      if (!canvas) {
        return { success: false, error: 'Failed to access canvas. The room may not exist.' }
      }

      const snapshot = await ops.getSnapshot()
      const summary = snapshot ? summarizeSnapshot(snapshot.snapshot) : null

      return {
        success: true,
        data: {
          canvas_id: canvas.id,
          room_id: canvas.room_id,
          title: canvas.title,
          page_count: summary?.page_count ?? 0,
          shape_count: summary?.shape_count ?? 0,
        },
      }
    }

    case 'list_canvas_shape_types': {
      const parsed = ListCanvasShapeTypesInput.safeParse(args)
      if (!parsed.success) return { success: false, error: parsed.error.message }

      return {
        success: true,
        data: {
          shape_types: [...BUILTIN_TLDRAW_SHAPE_TYPES],
          total: BUILTIN_TLDRAW_SHAPE_TYPES.length,
        },
      }
    }

    case 'list_canvas_shapes': {
      const parsed = ListCanvasShapesInput.safeParse(args)
      if (!parsed.success) return { success: false, error: parsed.error.message }

      const snapshot = await ops.getSnapshot()
      if (!snapshot) return { success: false, error: 'Failed to read canvas snapshot' }

      const { shapes } = summarizeSnapshot(snapshot.snapshot)
      let filtered = shapes

      if (parsed.data.page_id) {
        const directChildren = new Set(
          shapes.filter(s => s.parentId === parsed.data.page_id).map(s => s.id)
        )
        filtered = filtered.filter(
          s => s.parentId === parsed.data.page_id || directChildren.has(s.parentId ?? '')
        )
      }

      if (parsed.data.shape_type) {
        filtered = filtered.filter(s => s.type === parsed.data.shape_type)
      }

      return { success: true, data: { shapes: filtered, total: filtered.length } }
    }

    case 'get_canvas_snapshot': {
      const snapshot = await ops.getSnapshot()
      if (!snapshot) return { success: false, error: 'Failed to read canvas snapshot' }

      return {
        success: true,
        data: {
          canvas_id: snapshot.canvas_id,
          room_id: snapshot.room_id,
          data: snapshot.snapshot,
        },
      }
    }

    case 'create_canvas_shapes': {
      const parsed = CreateCanvasShapesInput.safeParse(args)
      if (!parsed.success) return { success: false, error: parsed.error.message }

      await ops.ensureCanvas()
      const snapshot = await ops.getSnapshot()
      const normalizedShapes = normalizeCreatedShapeRecords(parsed.data.shapes, snapshot?.snapshot)
      const result = await ops.applyMutations({ puts: normalizedShapes })
      if (!result) return { success: false, error: 'Failed to create shapes' }

      return {
        success: true,
        data: {
          ...result,
          created_shape_ids: parsed.data.shapes.map(s => s.id),
        },
      }
    }

    case 'update_canvas_shapes': {
      const parsed = UpdateCanvasShapesInput.safeParse(args)
      if (!parsed.success) return { success: false, error: parsed.error.message }

      const snapshot = await ops.getSnapshot()
      if (!snapshot) return { success: false, error: 'Failed to read canvas snapshot' }

      const context = getSnapshotContext(snapshot.snapshot)
      const hydratedUpdates: CanvasMutationPut[] = []

      for (const update of parsed.data.updates) {
        const existing = context.recordById.get(update.id)
        if (!existing || existing.typeName !== 'shape') {
          return { success: false, error: `Shape not found on canvas: ${update.id}` }
        }
        hydratedUpdates.push(mergeCanvasRecord(existing, update))
      }

      const result = await ops.applyMutations({ puts: hydratedUpdates })
      if (!result) return { success: false, error: 'Failed to update shapes' }

      return {
        success: true,
        data: {
          ...result,
          updated_shape_ids: parsed.data.updates.map(s => s.id),
        },
      }
    }

    case 'delete_canvas_shapes': {
      const parsed = DeleteCanvasShapesInput.safeParse(args)
      if (!parsed.success) return { success: false, error: parsed.error.message }

      const result = await ops.applyMutations({ deletes: parsed.data.shape_ids })
      if (!result) return { success: false, error: 'Failed to delete shapes' }

      return {
        success: true,
        data: {
          ...result,
          deleted_shape_ids: parsed.data.shape_ids,
        },
      }
    }

    case 'set_canvas_view': {
      const parsed = SetCanvasViewInput.safeParse(args)
      if (!parsed.success) return { success: false, error: parsed.error.message }

      return {
        success: true,
        data: {
          ok: true,
          view: parsed.data,
          message:
            'Viewport parameters recorded. Connected tldraw clients will need to apply these.',
        },
      }
    }

    case 'add_canvas_note': {
      const parsed = AddCanvasNoteInput.safeParse(args)
      if (!parsed.success) return { success: false, error: parsed.error.message }

      await ops.ensureCanvas()

      const noteSnapshot = await ops.getSnapshot()
      const noteId = createShapeId()
      const [noteShape] = normalizeCreatedShapeRecords([
        {
          id: noteId,
          type: 'note',
          x: parsed.data.x ?? 0,
          y: parsed.data.y ?? 0,
          props: { text: parsed.data.text },
        },
      ], noteSnapshot?.snapshot)

      const result = await ops.applyMutations({ puts: [noteShape] })
      if (!result) return { success: false, error: 'Failed to add note' }

      return {
        success: true,
        data: {
          ...result,
          created_shape_ids: [noteId],
        },
      }
    }

    default: {
      return { success: false, error: `Unknown canvas tool: ${tool}` }
    }
  }
}

export function createCanvasToolCallHandler(ops: CanvasOperations): DynamicToolCallHandler {
  return async (tool: string, args: unknown): Promise<DynamicToolCallResponse> => {
    const result = await executeCanvasTool(ops, tool, args)
    return result.success ? makeToolResponse(result.data) : makeToolError(result.error)
  }
}
