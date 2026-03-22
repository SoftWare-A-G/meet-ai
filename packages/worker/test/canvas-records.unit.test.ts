import { describe, expect, it } from 'vitest'
import { validateCanvasMutationPuts } from '../src/lib/canvas-records'

describe('canvas record normalization', () => {
  it('validates canonical tldraw shape records', () => {
    const result = validateCanvasMutationPuts([
      {
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
      },
    ])

    expect(result?.[0]?.id).toBe('shape:1')
  })

  it('rejects malformed shape records instead of patching them in the route', () => {
    expect(() =>
      validateCanvasMutationPuts([
        { id: 'shape:1', typeName: 'shape', type: 'note' },
      ]),
    ).toThrow()
  })
})
