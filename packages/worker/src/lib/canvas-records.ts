import { createTLSchema, type TLRecord } from '@tldraw/tlschema'

type CanvasMutationInputPut = Record<string, unknown> & { id: string; typeName: string }
type CanvasMutationPut = TLRecord

const CANVAS_SCHEMA = createTLSchema()
const RECORD_TYPES = CANVAS_SCHEMA.types as Record<string, { validate(record: unknown): TLRecord }>

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
