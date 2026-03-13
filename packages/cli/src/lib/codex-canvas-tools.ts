import { z } from 'zod'
import { makeToolResponse, makeToolError } from './codex-task-tools'
import type { DynamicToolSpec } from '@meet-ai/cli/generated/codex-app-server/v2/DynamicToolSpec'
import type { DynamicToolCallResponse } from '@meet-ai/cli/generated/codex-app-server/v2/DynamicToolCallResponse'
import type { DynamicToolCallHandler } from './codex-app-server'
import type { Canvas, CanvasSnapshot, CanvasMutationResult } from './hooks/canvas'

// --- Zod input schemas ---

export const GetCanvasStateInput = z.object({})

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

const listCanvasShapesJsonSchema = {
  type: 'object',
  properties: {
    page_id: { type: 'string', description: 'Filter shapes by page ID' },
    shape_type: { type: 'string', description: 'Filter shapes by type (e.g. "geo", "arrow", "text", "note")' },
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
    text: { type: 'string', description: 'Note text content (1-5000 chars)', minLength: 1, maxLength: 5000 },
    x: { type: 'number', description: 'X position on canvas' },
    y: { type: 'number', description: 'Y position on canvas' },
  },
  required: ['text'],
  additionalProperties: false,
}

// --- DynamicToolSpec definitions ---

// Read tools — no permission review needed
export const CANVAS_READ_TOOL_SPECS: DynamicToolSpec[] = [
  {
    name: 'get_canvas_state',
    description:
      'Get the current canvas state including metadata, page summary, and shape counts for the room canvas.',
    inputSchema: getCanvasStateJsonSchema,
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
      'Get the raw tldraw document snapshot for the room canvas. Returns the full snapshot including all records (pages, shapes, assets, etc.).',
    inputSchema: getCanvasSnapshotJsonSchema,
  },
]

// Write tools — require permission review
export const CANVAS_WRITE_TOOL_SPECS: DynamicToolSpec[] = [
  {
    name: 'create_canvas_shapes',
    description:
      'Create new shapes on the room canvas. Each shape must have an "id" field. Uses tldraw shape format.',
    inputSchema: createCanvasShapesJsonSchema,
  },
  {
    name: 'update_canvas_shapes',
    description:
      'Update existing shapes on the room canvas. Each update must have an "id" field identifying the shape to modify.',
    inputSchema: updateCanvasShapesJsonSchema,
  },
  {
    name: 'delete_canvas_shapes',
    description:
      'Delete shapes from the room canvas by their IDs.',
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
      'Add a text note to the room canvas at the specified position. Creates a tldraw note shape.',
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

// --- Permission review for write tools ---

/** Maps tool names to stable permission review identifiers. */
const CANVAS_PERMISSION_TOOL_NAMES: Record<string, string> = {
  create_canvas_shapes: 'CanvasCreateShapes',
  update_canvas_shapes: 'CanvasUpdateShapes',
  delete_canvas_shapes: 'CanvasDeleteShapes',
  set_canvas_view: 'CanvasSetView',
  add_canvas_note: 'CanvasCreateShapes',
}

export type PermissionDecision = {
  status: 'approved' | 'denied' | 'expired'
  feedback?: string
}

export type PermissionReviewer = (
  toolName: string,
  formattedContent: string,
  toolInputJson?: string,
) => Promise<PermissionDecision | null>

function formatPermissionContent(tool: string, args: unknown): string {
  switch (tool) {
    case 'create_canvas_shapes': {
      const input = args as { shapes: Array<{ id: string; type?: string }> }
      return `Agent wants to create ${input.shapes.length} shape(s) on the canvas:\n${input.shapes.map(s => `- ${s.type ?? 'shape'} (${s.id})`).join('\n')}`
    }
    case 'update_canvas_shapes': {
      const input = args as { updates: Array<{ id: string }> }
      return `Agent wants to update ${input.updates.length} shape(s) on the canvas:\n${input.updates.map(s => `- ${s.id}`).join('\n')}`
    }
    case 'delete_canvas_shapes': {
      const input = args as { shape_ids: string[] }
      return `Agent wants to delete ${input.shape_ids.length} shape(s) from the canvas:\n${input.shape_ids.map(id => `- ${id}`).join('\n')}`
    }
    case 'set_canvas_view': {
      const input = args as { focus_shape_ids?: string[]; x?: number; y?: number; zoom?: number }
      const parts: string[] = []
      if (input.focus_shape_ids?.length) parts.push(`focus on ${input.focus_shape_ids.length} shape(s)`)
      if (input.x != null || input.y != null) parts.push(`move to (${input.x ?? 0}, ${input.y ?? 0})`)
      if (input.zoom != null) parts.push(`zoom to ${input.zoom}`)
      return `Agent wants to set canvas viewport: ${parts.join(', ')}`
    }
    case 'add_canvas_note': {
      const input = args as { text: string; x?: number; y?: number }
      const preview = input.text.length > 100 ? `${input.text.slice(0, 100)}...` : input.text
      return `Agent wants to add a note to the canvas:\n"${preview}"${input.x != null ? ` at (${input.x}, ${input.y ?? 0})` : ''}`
    }
    default:
      return `Agent wants to use ${tool} on the canvas`
  }
}

// --- Index utilities ---

/**
 * Compute the next fractional index that sorts after all existing indexes.
 * tldraw uses lexicographic string indexes (e.g. "a1", "a2", "a1V").
 * We find the highest existing index and append "V" to guarantee it sorts after.
 */
function getNextIndex(existingIndexes: string[]): string {
  if (existingIndexes.length === 0) return 'a1'
  const sorted = [...existingIndexes].sort()
  const highest = sorted[sorted.length - 1]
  return `${highest}V`
}

type CanvasRecord = Record<string, unknown> & { id: string }
type CanvasMutationPut = Record<string, unknown> & { id: string; typeName: string }

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

function getDefaultShapeProps(type: string, props: Record<string, unknown>): Record<string, unknown> {
  switch (type) {
    case 'geo':
      return {
        geo: 'rectangle',
        w: 200,
        h: 100,
        color: 'black',
        labelColor: 'black',
        fill: 'none',
        dash: 'solid',
        size: 'm',
        font: 'draw',
        text: '',
        align: 'middle',
        verticalAlign: 'middle',
        growY: 0,
        url: '',
        ...props,
      }
    case 'note':
      return {
        color: 'yellow',
        size: 'm',
        text: '',
        font: 'draw',
        align: 'middle',
        verticalAlign: 'middle',
        growY: 0,
        fontSizeAdjustment: 0,
        url: '',
        ...props,
      }
    case 'text':
      return {
        color: 'black',
        size: 'm',
        text: '',
        font: 'draw',
        textAlign: 'start',
        autoSize: true,
        scale: 1,
        w: 200,
        ...props,
      }
    case 'arrow':
      return {
        color: 'black',
        fill: 'none',
        dash: 'draw',
        size: 'm',
        arrowheadStart: 'none',
        arrowheadEnd: 'arrow',
        font: 'draw',
        start: { x: 0, y: 0 },
        end: { x: 100, y: 0 },
        bend: 0,
        text: '',
        labelPosition: 0.5,
        scale: 1,
        ...props,
      }
    case 'frame':
      return {
        w: 800,
        h: 600,
        name: 'Frame',
        ...props,
      }
    default:
      return props
  }
}

function normalizeCreatedShapeRecords(shapes: CanvasRecord[], snapshot: unknown): CanvasMutationPut[] {
  const context = getSnapshotContext(snapshot)
  const defaultPageId = context.pageIds[0] ?? 'page:page'
  const reservedIndexes = new Map<string, string[]>()

  return shapes.map(shape => {
    if (shape.typeName === 'shape') return shape as CanvasMutationPut

    const parentId = typeof shape.parentId === 'string' ? shape.parentId : defaultPageId
    const existingSiblingIndexes = context.shapeRecords
      .filter(record => record.parentId === parentId && typeof record.index === 'string')
      .map(record => record.index as string)
    const pendingSiblingIndexes = reservedIndexes.get(parentId) ?? []
    const index =
      typeof shape.index === 'string' ? shape.index : getNextIndex([...existingSiblingIndexes, ...pendingSiblingIndexes])

    reservedIndexes.set(parentId, [...pendingSiblingIndexes, index])

    const type = typeof shape.type === 'string' ? shape.type : 'geo'
    const props = isRecordObject(shape.props) ? shape.props : {}

    return {
      ...shape,
      typeName: 'shape',
      type,
      x: typeof shape.x === 'number' ? shape.x : 0,
      y: typeof shape.y === 'number' ? shape.y : 0,
      rotation: typeof shape.rotation === 'number' ? shape.rotation : 0,
      parentId,
      index,
      isLocked: typeof shape.isLocked === 'boolean' ? shape.isLocked : false,
      opacity: typeof shape.opacity === 'number' ? shape.opacity : 1,
      meta: isRecordObject(shape.meta) ? shape.meta : {},
      props: getDefaultShapeProps(type, props),
    }
  })
}

function mergeCanvasRecord(existing: CanvasRecord, update: CanvasRecord): CanvasMutationPut {
  const existingProps = isRecordObject(existing.props) ? existing.props : {}
  const updateProps = isRecordObject(update.props) ? update.props : {}
  const existingMeta = isRecordObject(existing.meta) ? existing.meta : {}
  const updateMeta = isRecordObject(update.meta) ? update.meta : {}

  return {
    ...existing,
    ...update,
    typeName: typeof update.typeName === 'string' ? update.typeName : typeof existing.typeName === 'string' ? existing.typeName : 'shape',
    props: { ...existingProps, ...updateProps },
    meta: { ...existingMeta, ...updateMeta },
  }
}

// --- Canvas tool call handler ---

export type CanvasOperations = {
  ensureCanvas(): Promise<Canvas | null>
  getSnapshot(): Promise<CanvasSnapshot | null>
  applyMutations(mutations: {
    puts?: Array<Record<string, unknown> & { id: string; typeName: string }>
    deletes?: string[]
  }): Promise<CanvasMutationResult | null>
  requestPermission?: PermissionReviewer
}

function summarizeSnapshot(snapshot: unknown): {
  page_count: number
  page_ids: string[]
  shape_count: number
  shapes: Array<{ id: string; type: string; parentId?: string; index?: string; x?: number; y?: number }>
} {
  if (!snapshot || typeof snapshot !== 'object') {
    return { page_count: 0, page_ids: [], shape_count: 0, shapes: [] }
  }

  const records = (snapshot as Record<string, unknown>).records
  if (!Array.isArray(records)) {
    return { page_count: 0, page_ids: [], shape_count: 0, shapes: [] }
  }

  const pageIds: string[] = []
  const shapes: Array<{ id: string; type: string; parentId?: string; index?: string; x?: number; y?: number }> = []

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

async function checkPermission(
  ops: CanvasOperations,
  tool: string,
  args: unknown,
): Promise<DynamicToolCallResponse | null> {
  if (!ops.requestPermission || !CANVAS_WRITE_TOOL_NAMES.has(tool)) return null

  const permToolName = CANVAS_PERMISSION_TOOL_NAMES[tool] ?? tool
  const content = formatPermissionContent(tool, args)
  const decision = await ops.requestPermission(permToolName, content, JSON.stringify(args))

  if (!decision || decision.status === 'expired') {
    return makeToolError('Permission review expired or unavailable. The action was not performed.')
  }

  if (decision.status === 'denied') {
    return makeToolError(
      `Permission denied${decision.feedback ? `: ${decision.feedback}` : '. The action was not performed.'}`
    )
  }

  // approved — continue
  return null
}

export function createCanvasToolCallHandler(ops: CanvasOperations): DynamicToolCallHandler {
  return async (tool: string, args: unknown): Promise<DynamicToolCallResponse> => {
    if (!CANVAS_TOOL_NAMES.has(tool)) {
      return makeToolError(`Unknown canvas tool: ${tool}`)
    }

    // Check permission for write tools before executing
    if (CANVAS_WRITE_TOOL_NAMES.has(tool)) {
      const denied = await checkPermission(ops, tool, args)
      if (denied) return denied
    }

    switch (tool) {
      case 'get_canvas_state': {
        const canvas = await ops.ensureCanvas()
        if (!canvas) return makeToolError('Failed to access canvas. The room may not exist.')

        const snapshot = await ops.getSnapshot()
        const summary = snapshot ? summarizeSnapshot(snapshot.snapshot) : null

        return makeToolResponse({
          canvas_id: canvas.id,
          room_id: canvas.room_id,
          title: canvas.title,
          page_count: summary?.page_count ?? 0,
          shape_count: summary?.shape_count ?? 0,
        })
      }

      case 'list_canvas_shapes': {
        const parsed = ListCanvasShapesInput.safeParse(args)
        if (!parsed.success) return makeToolError(parsed.error.message)

        const snapshot = await ops.getSnapshot()
        if (!snapshot) return makeToolError('Failed to read canvas snapshot')

        const { shapes } = summarizeSnapshot(snapshot.snapshot)
        let filtered = shapes

        if (parsed.data.page_id) {
          // Include shapes whose parentId matches the page directly,
          // or shapes nested under a shape that belongs to the page
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

        return makeToolResponse({ shapes: filtered, total: filtered.length })
      }

      case 'get_canvas_snapshot': {
        const snapshot = await ops.getSnapshot()
        if (!snapshot) return makeToolError('Failed to read canvas snapshot')

        return makeToolResponse({
          canvas_id: snapshot.canvas_id,
          room_id: snapshot.room_id,
          data: snapshot.snapshot,
        })
      }

      case 'create_canvas_shapes': {
        const parsed = CreateCanvasShapesInput.safeParse(args)
        if (!parsed.success) return makeToolError(parsed.error.message)

        await ops.ensureCanvas()
        const snapshot = await ops.getSnapshot()
        const normalizedShapes = normalizeCreatedShapeRecords(parsed.data.shapes, snapshot?.snapshot)
        const result = await ops.applyMutations({ puts: normalizedShapes })
        if (!result) return makeToolError('Failed to create shapes')

        return makeToolResponse({
          ...result,
          created_shape_ids: parsed.data.shapes.map(s => s.id),
        })
      }

      case 'update_canvas_shapes': {
        const parsed = UpdateCanvasShapesInput.safeParse(args)
        if (!parsed.success) return makeToolError(parsed.error.message)

        const snapshot = await ops.getSnapshot()
        if (!snapshot) return makeToolError('Failed to read canvas snapshot')

        const context = getSnapshotContext(snapshot.snapshot)
        const hydratedUpdates: CanvasMutationPut[] = []

        for (const update of parsed.data.updates) {
          const existing = context.recordById.get(update.id)
          if (!existing || existing.typeName !== 'shape') {
            return makeToolError(`Shape not found on canvas: ${update.id}`)
          }
          hydratedUpdates.push(mergeCanvasRecord(existing, update))
        }

        const result = await ops.applyMutations({ puts: hydratedUpdates })
        if (!result) return makeToolError('Failed to update shapes')

        return makeToolResponse({
          ...result,
          updated_shape_ids: parsed.data.updates.map(s => s.id),
        })
      }

      case 'delete_canvas_shapes': {
        const parsed = DeleteCanvasShapesInput.safeParse(args)
        if (!parsed.success) return makeToolError(parsed.error.message)

        const result = await ops.applyMutations({ deletes: parsed.data.shape_ids })
        if (!result) return makeToolError('Failed to delete shapes')

        return makeToolResponse({
          ...result,
          deleted_shape_ids: parsed.data.shape_ids,
        })
      }

      case 'set_canvas_view': {
        const parsed = SetCanvasViewInput.safeParse(args)
        if (!parsed.success) return makeToolError(parsed.error.message)

        // set_canvas_view is a client-side concern in tldraw.
        // For now, return the requested viewport params as acknowledgment.
        return makeToolResponse({
          ok: true,
          view: parsed.data,
          message: 'Viewport parameters recorded. Connected tldraw clients will need to apply these.',
        })
      }

      case 'add_canvas_note': {
        const parsed = AddCanvasNoteInput.safeParse(args)
        if (!parsed.success) return makeToolError(parsed.error.message)

        await ops.ensureCanvas()

        // Discover active page ID and compute next index from snapshot
        const noteSnapshot = await ops.getSnapshot()
        const noteSummary = noteSnapshot ? summarizeSnapshot(noteSnapshot.snapshot) : null
        const pageId = noteSummary?.page_ids[0] ?? 'page:page'
        const pageShapeIndexes = (noteSummary?.shapes ?? [])
          .filter(s => s.parentId === pageId && s.index)
          .map(s => s.index as string)
        const noteIndex = getNextIndex(pageShapeIndexes)

        const noteId = `shape:note_${Date.now()}`
        const noteShape = {
          id: noteId,
          type: 'note',
          typeName: 'shape',
          x: parsed.data.x ?? 0,
          y: parsed.data.y ?? 0,
          rotation: 0,
          isLocked: false,
          props: {
            color: 'yellow',
            size: 'm',
            text: parsed.data.text,
            font: 'draw',
            align: 'middle',
            verticalAlign: 'middle',
            growY: 0,
            url: '',
          },
          parentId: pageId,
          index: noteIndex,
          meta: {},
        }

        const result = await ops.applyMutations({ puts: [noteShape] })
        if (!result) return makeToolError('Failed to add note')

        return makeToolResponse({
          ...result,
          created_shape_ids: [noteId],
        })
      }

      default: {
        return makeToolError(`Unknown canvas tool: ${tool}`)
      }
    }
  }
}
