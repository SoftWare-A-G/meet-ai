import { createTLSchema, toRichText, type TLRecord } from '@tldraw/tlschema'
import {
  TextShapeUtil,
  BookmarkShapeUtil,
  DrawShapeUtil,
  GeoShapeUtil,
  NoteShapeUtil,
  LineShapeUtil,
  FrameShapeUtil,
  ArrowShapeUtil,
  HighlightShapeUtil,
  EmbedShapeUtil,
  ImageShapeUtil,
  VideoShapeUtil,
} from 'tldraw'

const DEFAULT_SHAPE_PROPS_BY_TYPE = {
  [TextShapeUtil.type]: TextShapeUtil,
  [BookmarkShapeUtil.type]: BookmarkShapeUtil,
  [DrawShapeUtil.type]: DrawShapeUtil,
  [GeoShapeUtil.type]: GeoShapeUtil,
  [NoteShapeUtil.type]: NoteShapeUtil,
  [LineShapeUtil.type]: LineShapeUtil,
  [FrameShapeUtil.type]: FrameShapeUtil,
  [ArrowShapeUtil.type]: ArrowShapeUtil,
  [HighlightShapeUtil.type]: HighlightShapeUtil,
  [EmbedShapeUtil.type]: EmbedShapeUtil,
  [ImageShapeUtil.type]: ImageShapeUtil,
  [VideoShapeUtil.type]: VideoShapeUtil,
} as const

type CanvasRecord = Record<string, unknown> & { id: string }
type CanvasMutationInputPut = Record<string, unknown> & { id: string; typeName: string }
type CanvasMutationPut = TLRecord

const CANVAS_SCHEMA = createTLSchema()
const RECORD_TYPES = CANVAS_SCHEMA.types as Record<string, { validate(record: unknown): TLRecord }>

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
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
  type: keyof typeof DEFAULT_SHAPE_PROPS_BY_TYPE,
  props: Record<string, unknown>
): Record<string, unknown> {
  const shape = DEFAULT_SHAPE_PROPS_BY_TYPE[type]
  if (!shape) return props

  const defaultProps = shape.props
  const mergedProps = { ...defaultProps, ...props }

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

export function validateCanvasMutationPuts(
  puts: CanvasMutationInputPut[] | undefined
): CanvasMutationPut[] | undefined {
  return puts?.map(put => validateCanvasRecord(put))
}
