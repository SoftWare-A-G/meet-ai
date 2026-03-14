import { describe, expect, it, vi } from 'vitest'
import { repairLegacyCanvasShapeRecords, validateCanvasMutationPuts } from '../src/lib/canvas-records'

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

  it('repairs persisted legacy notes using tldraw defaults and rich text', () => {
    const set = vi.fn()
    const didRepair = repairLegacyCanvasShapeRecords({
      entries: function* () {
        yield ['shape:1', {
          id: 'shape:1',
          typeName: 'shape',
          type: 'note',
          parentId: 'page:page',
          index: 'a1',
          props: { text: 'hello' },
        }]
        yield ['page:page', { id: 'page:page', typeName: 'page' }]
      },
      set,
    })

    expect(didRepair).toBe(true)
    expect(set).toHaveBeenCalledTimes(1)
    expect(set).toHaveBeenCalledWith('shape:1', {
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
        richText: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hello' }] }],
        },
        scale: 1,
      },
    })
  })

  it('repairs persisted legacy videos using shipped autoplay defaults', () => {
    const set = vi.fn()
    const didRepair = repairLegacyCanvasShapeRecords({
      entries: function* () {
        yield ['shape:video-1', {
          id: 'shape:video-1',
          typeName: 'shape',
          type: 'video',
          parentId: 'page:page',
          index: 'a2',
          props: { url: 'https://example.com/video.mp4' },
        }]
      },
      set,
    })

    expect(didRepair).toBe(true)
    expect(set).toHaveBeenCalledTimes(1)
    expect(set).toHaveBeenCalledWith('shape:video-1', {
      id: 'shape:video-1',
      typeName: 'shape',
      type: 'video',
      x: 0,
      y: 0,
      rotation: 0,
      parentId: 'page:page',
      index: 'a2',
      isLocked: false,
      opacity: 1,
      meta: {},
      props: {
        w: 100,
        h: 100,
        assetId: null,
        autoplay: true,
        url: 'https://example.com/video.mp4',
        altText: '',
        time: 0,
        playing: true,
      },
    })
  })
})
