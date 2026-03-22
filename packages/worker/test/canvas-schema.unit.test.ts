import { describe, expect, it } from 'vitest'
import { canvasMutationsSchema } from '../src/schemas/canvas'

describe('canvasMutationsSchema', () => {
  it('accepts puts that include a valid record type name and required fields', () => {
    const result = canvasMutationsSchema.safeParse({
      puts: [{
        id: 'shape:1',
        typeName: 'shape',
        type: 'note',
        x: 0,
        y: 0,
        rotation: 0,
        parentId: 'page:page',
        index: 'a1',
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
      }],
    })

    expect(result.success).toBe(true)
  })

  it('rejects puts without a record type name', () => {
    const result = canvasMutationsSchema.safeParse({
      puts: [{ id: 'shape:1', type: 'geo' }],
    })

    expect(result.success).toBe(false)
  })
})
