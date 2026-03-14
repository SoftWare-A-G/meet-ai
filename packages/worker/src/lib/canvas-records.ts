import { createTLSchema, toRichText, type TLRecord } from '@tldraw/tlschema'
// @ts-expect-error tldraw does not ship declarations for this compiled subpath
import { defaultShapeUtils } from '../../node_modules/tldraw/dist-esm/lib/defaultShapeUtils.mjs'
import type { TLSyncStorageTransaction } from '@tldraw/sync-core'

type CanvasRecord = Record<string, unknown> & { id: string }
type CanvasMutationInputPut = Record<string, unknown> & { id: string; typeName: string }
type CanvasMutationPut = TLRecord
type ShapeUtilConstructor = {
  type: string
  new (editor: unknown): { getDefaultProps(): unknown }
}

const CANVAS_SCHEMA = createTLSchema()
const SHAPE_RECORD_TYPE = CANVAS_SCHEMA.types.shape
const RECORD_TYPES = CANVAS_SCHEMA.types as Record<
  string,
  {
    validate(record: unknown): TLRecord
  }
>
const SHAPE_UTILS = defaultShapeUtils as ShapeUtilConstructor[]
const DEFAULT_SHAPE_PROPS_BY_TYPE = new Map<string, () => Record<string, unknown>>(
  SHAPE_UTILS.map(ShapeUtilCtor => [
    ShapeUtilCtor.type,
    () => new ShapeUtilCtor(undefined).getDefaultProps() as Record<string, unknown>,
  ])
)

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isCanvasRecord(value: unknown): value is CanvasRecord {
  return isRecordObject(value) && typeof value.id === 'string'
}

function hasCanvasTypeName(value: unknown): value is CanvasMutationInputPut {
  return isCanvasRecord(value) && typeof value.typeName === 'string'
}

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

function getDefaultShapeProps(
  type: string,
  props: Record<string, unknown>
): Record<string, unknown> {
  const getDefaultProps = DEFAULT_SHAPE_PROPS_BY_TYPE.get(type)
  if (!getDefaultProps) return props

  const defaultProps = getDefaultProps()
  const mergedProps = {
    ...defaultProps,
    ...props,
  }

  if (!('richText' in defaultProps) && !isRecordObject(props.richText)) {
    return mergedProps
  }

  return withRichText(
    mergedProps,
    typeof props.text === 'string' ? props.text : '',
    !isRecordObject(props.richText)
  )
}

function validateCanvasRecord(record: CanvasMutationInputPut): CanvasMutationPut {
  const recordType = RECORD_TYPES[record.typeName]
  if (!recordType) {
    throw new Error(`Unsupported canvas record type: ${record.typeName}`)
  }

  return recordType.validate(record)
}

function repairLegacyShapeRecord(record: CanvasRecord): CanvasMutationPut | null {
  if (record.typeName !== 'shape' || typeof record.type !== 'string') return null

  const repaired = SHAPE_RECORD_TYPE.create({
    ...record,
    id: record.id,
    type: record.type,
    props: getDefaultShapeProps(record.type, isRecordObject(record.props) ? record.props : {}),
    meta: isRecordObject(record.meta) ? record.meta : {},
  } as Parameters<typeof SHAPE_RECORD_TYPE.create>[0])

  return SHAPE_RECORD_TYPE.validate(repaired) as CanvasMutationPut
}

export function validateCanvasMutationPuts(
  puts: CanvasMutationInputPut[] | undefined
): CanvasMutationPut[] | undefined {
  return puts?.map(put => validateCanvasRecord(put))
}

export function repairLegacyCanvasShapeRecords(
  txn: Pick<TLSyncStorageTransaction<TLRecord>, 'entries' | 'set'>
): boolean {
  let didRepair = false

  for (const [id, record] of txn.entries()) {
    if (!hasCanvasTypeName(record)) continue

    try {
      validateCanvasRecord(record)
      continue
    } catch {
      const repaired = repairLegacyShapeRecord(record)
      if (!repaired) continue

      txn.set(id, repaired)
      didRepair = true
    }
  }

  return didRepair
}
