import { describe, it, expect, beforeEach } from 'vitest'
import {
  generateId,
  sortByPosition,
  getAnnotationsByBlock,
  createAnnotation,
  type Annotation,
  type AnnotationType,
} from '../src/app/components/PlanReviewCard/annotations'
import { exportDiff } from '../src/app/components/PlanReviewCard/exportDiff'

function makeAnnotation(
  overrides: Partial<Annotation> & { type: AnnotationType; originalText: string },
): Annotation {
  return {
    id: 'test-id',
    blockId: 'block-0',
    startOffset: 0,
    endOffset: 10,
    createdAt: Date.now(),
    ...overrides,
  }
}

// ─── generateId ─────────────────────────────────────────────────────────────

describe('generateId', () => {
  it('returns a string with ann- prefix', () => {
    const id = generateId()
    expect(id).toMatch(/^ann-/)
  })

  it('returns unique IDs on consecutive calls', () => {
    const ids = new Set(Array.from({ length: 10 }, () => generateId()))
    expect(ids.size).toBe(10)
  })

  it('increments the counter portion', () => {
    const a = generateId()
    const b = generateId()
    const counterA = Number(a.split('-')[2])
    const counterB = Number(b.split('-')[2])
    expect(counterB).toBe(counterA + 1)
  })
})

// ─── sortByPosition ──────────────────────────────────────────────────────────

describe('sortByPosition', () => {
  it('returns empty array for empty input', () => {
    expect(sortByPosition([])).toEqual([])
  })

  it('does not mutate the input array', () => {
    const ann1 = makeAnnotation({ type: 'DELETION', originalText: 'a', blockId: 'b', startOffset: 5, endOffset: 10 })
    const ann2 = makeAnnotation({ type: 'DELETION', originalText: 'b', blockId: 'a', startOffset: 0, endOffset: 5 })
    const input = [ann1, ann2]
    sortByPosition(input)
    expect(input[0]).toBe(ann1)
    expect(input[1]).toBe(ann2)
  })

  it('sorts by blockId first', () => {
    const ann1 = makeAnnotation({ type: 'DELETION', originalText: 'x', blockId: 'block-b', startOffset: 0, endOffset: 5 })
    const ann2 = makeAnnotation({ type: 'DELETION', originalText: 'y', blockId: 'block-a', startOffset: 0, endOffset: 5 })
    const result = sortByPosition([ann1, ann2])
    expect(result[0].blockId).toBe('block-a')
    expect(result[1].blockId).toBe('block-b')
  })

  it('sorts by startOffset within the same blockId', () => {
    const ann1 = makeAnnotation({ type: 'DELETION', originalText: 'x', blockId: 'block-0', startOffset: 10, endOffset: 20 })
    const ann2 = makeAnnotation({ type: 'DELETION', originalText: 'y', blockId: 'block-0', startOffset: 0, endOffset: 5 })
    const result = sortByPosition([ann1, ann2])
    expect(result[0].startOffset).toBe(0)
    expect(result[1].startOffset).toBe(10)
  })

  it('sorts by endOffset when blockId and startOffset are equal', () => {
    const ann1 = makeAnnotation({ type: 'DELETION', originalText: 'x', blockId: 'block-0', startOffset: 0, endOffset: 20 })
    const ann2 = makeAnnotation({ type: 'DELETION', originalText: 'y', blockId: 'block-0', startOffset: 0, endOffset: 5 })
    const result = sortByPosition([ann1, ann2])
    expect(result[0].endOffset).toBe(5)
    expect(result[1].endOffset).toBe(20)
  })

  it('handles single annotation', () => {
    const ann = makeAnnotation({ type: 'COMMENT', originalText: 'text' })
    expect(sortByPosition([ann])).toEqual([ann])
  })
})

// ─── getAnnotationsByBlock ───────────────────────────────────────────────────

describe('getAnnotationsByBlock', () => {
  it('returns empty array when no annotations match blockId', () => {
    const ann = makeAnnotation({ type: 'DELETION', originalText: 'x', blockId: 'block-1' })
    expect(getAnnotationsByBlock([ann], 'block-2')).toEqual([])
  })

  it('filters annotations by blockId', () => {
    const ann1 = makeAnnotation({ type: 'DELETION', originalText: 'x', blockId: 'block-1' })
    const ann2 = makeAnnotation({ type: 'COMMENT', originalText: 'y', blockId: 'block-2' })
    const result = getAnnotationsByBlock([ann1, ann2], 'block-1')
    expect(result).toHaveLength(1)
    expect(result[0].blockId).toBe('block-1')
  })

  it('returns annotations sorted by position within the block', () => {
    const ann1 = makeAnnotation({ type: 'DELETION', originalText: 'x', blockId: 'block-1', startOffset: 10, endOffset: 20 })
    const ann2 = makeAnnotation({ type: 'COMMENT', originalText: 'y', blockId: 'block-1', startOffset: 0, endOffset: 5 })
    const result = getAnnotationsByBlock([ann1, ann2], 'block-1')
    expect(result[0].startOffset).toBe(0)
    expect(result[1].startOffset).toBe(10)
  })
})

// ─── createAnnotation ────────────────────────────────────────────────────────

describe('createAnnotation', () => {
  it('assigns a generated id with ann- prefix', () => {
    const ann = createAnnotation({ blockId: 'b', startOffset: 0, endOffset: 5, type: 'DELETION', originalText: 'hello' })
    expect(ann.id).toMatch(/^ann-/)
  })

  it('assigns a numeric createdAt timestamp', () => {
    const before = Date.now()
    const ann = createAnnotation({ blockId: 'b', startOffset: 0, endOffset: 5, type: 'DELETION', originalText: 'hello' })
    const after = Date.now()
    expect(ann.createdAt).toBeGreaterThanOrEqual(before)
    expect(ann.createdAt).toBeLessThanOrEqual(after)
  })

  it('spreads all provided params onto the annotation', () => {
    const ann = createAnnotation({
      blockId: 'block-5',
      startOffset: 3,
      endOffset: 7,
      type: 'REPLACEMENT',
      originalText: 'foo',
      text: 'bar',
      author: 'alice',
    })
    expect(ann.blockId).toBe('block-5')
    expect(ann.startOffset).toBe(3)
    expect(ann.endOffset).toBe(7)
    expect(ann.type).toBe('REPLACEMENT')
    expect(ann.originalText).toBe('foo')
    expect(ann.text).toBe('bar')
    expect(ann.author).toBe('alice')
  })
})

// ─── exportDiff ──────────────────────────────────────────────────────────────

describe('exportDiff', () => {
  it('returns empty string for empty annotations array', () => {
    expect(exportDiff([])).toBe('')
  })

  it('uses singular "piece" for one annotation', () => {
    const ann = makeAnnotation({ type: 'DELETION', originalText: 'foo' })
    const result = exportDiff([ann])
    expect(result).toContain("have 1 piece of feedback")
    expect(result).not.toContain("pieces")
  })

  it('uses plural "pieces" for multiple annotations', () => {
    const ann1 = makeAnnotation({ type: 'DELETION', originalText: 'foo' })
    const ann2 = makeAnnotation({ type: 'COMMENT', originalText: 'bar', text: 'nice', startOffset: 5, endOffset: 10 })
    const result = exportDiff([ann1, ann2])
    expect(result).toContain("have 2 pieces of feedback")
  })

  describe('DELETION', () => {
    it('renders Remove this heading with code block', () => {
      const ann = makeAnnotation({ type: 'DELETION', originalText: 'delete me' })
      const result = exportDiff([ann])
      expect(result).toContain('## 1. Remove this')
      expect(result).toContain('```\ndelete me\n```')
    })

    it('does not include blockquote when text is absent', () => {
      const ann = makeAnnotation({ type: 'DELETION', originalText: 'delete me' })
      const result = exportDiff([ann])
      expect(result).not.toContain('> ')
    })

    it('includes blockquote rationale when text is provided', () => {
      const ann = makeAnnotation({ type: 'DELETION', originalText: 'delete me', text: 'Not needed' })
      const result = exportDiff([ann])
      expect(result).toContain('> Not needed')
    })

    it('escapes triple backticks inside code block content', () => {
      const ann = makeAnnotation({ type: 'DELETION', originalText: 'use ```code``` here' })
      const result = exportDiff([ann])
      expect(result).toContain('\\`\\`\\`code\\`\\`\\`')
    })
  })

  describe('REPLACEMENT', () => {
    it('renders Change this heading with From and To', () => {
      const ann = makeAnnotation({ type: 'REPLACEMENT', originalText: 'old text', text: 'new text' })
      const result = exportDiff([ann])
      expect(result).toContain('## 1. Change this')
      expect(result).toContain('**From:** old text')
      expect(result).toContain('**To:** new text')
    })

    it('escapes markdown special characters in originalText and text', () => {
      const ann = makeAnnotation({
        type: 'REPLACEMENT',
        originalText: 'a | b',
        text: 'c [link] d',
      })
      const result = exportDiff([ann])
      expect(result).toContain('**From:** a \\| b')
      expect(result).toContain('**To:** c \\[link\\] d')
    })

    it('handles missing text (empty To)', () => {
      const ann = makeAnnotation({ type: 'REPLACEMENT', originalText: 'old' })
      const result = exportDiff([ann])
      // text is undefined → escapeMarkdown('') → '' so the line is exactly '**To:**'
      expect(result).toContain('**To:**')
    })
  })

  describe('COMMENT', () => {
    it('renders Feedback on heading with quoted original text', () => {
      const ann = makeAnnotation({ type: 'COMMENT', originalText: 'some text', text: 'my comment' })
      const result = exportDiff([ann])
      expect(result).toContain('## 1. Feedback on: "some text"')
      expect(result).toContain('> my comment')
    })

    it('escapes angle brackets in comment text', () => {
      const ann = makeAnnotation({ type: 'COMMENT', originalText: 'text', text: '<important>' })
      const result = exportDiff([ann])
      expect(result).toContain('> \\<important\\>')
    })

    it('escapes double quotes in originalText for the heading', () => {
      const ann = makeAnnotation({ type: 'COMMENT', originalText: 'say "hello"', text: 'note' })
      const result = exportDiff([ann])
      expect(result).toContain('Feedback on: "say \\"hello\\""')
    })

    it('escapes backticks in originalText', () => {
      const ann = makeAnnotation({ type: 'COMMENT', originalText: 'use `code`', text: 'note' })
      const result = exportDiff([ann])
      expect(result).toContain('Feedback on: "use \\`code\\`"')
    })
  })

  describe('multiple annotations', () => {
    it('numbers annotations sequentially starting from 1', () => {
      const ann1 = makeAnnotation({ type: 'DELETION', originalText: 'a', blockId: 'block-0', startOffset: 0 })
      const ann2 = makeAnnotation({ type: 'COMMENT', originalText: 'b', blockId: 'block-0', startOffset: 5, text: 'x' })
      const ann3 = makeAnnotation({ type: 'REPLACEMENT', originalText: 'c', blockId: 'block-0', startOffset: 10, text: 'd' })
      const result = exportDiff([ann1, ann2, ann3])
      expect(result).toContain('## 1. Remove this')
      expect(result).toContain('## 2. Feedback on:')
      expect(result).toContain('## 3. Change this')
    })

    it('sorts annotations by position before numbering', () => {
      // ann2 has lower startOffset so should appear as #1
      const ann1 = makeAnnotation({ type: 'DELETION', originalText: 'later', blockId: 'block-0', startOffset: 20, endOffset: 25 })
      const ann2 = makeAnnotation({ type: 'COMMENT', originalText: 'earlier', blockId: 'block-0', startOffset: 0, endOffset: 5, text: 'note' })
      const result = exportDiff([ann1, ann2])
      const idx1 = result.indexOf('## 1. Feedback on:')
      const idx2 = result.indexOf('## 2. Remove this')
      expect(idx1).toBeLessThan(idx2)
    })
  })

  it('does not end with a trailing newline', () => {
    const ann = makeAnnotation({ type: 'DELETION', originalText: 'foo' })
    const result = exportDiff([ann])
    expect(result).not.toMatch(/\n$/)
  })

  it('starts with # Plan Feedback heading', () => {
    const ann = makeAnnotation({ type: 'DELETION', originalText: 'foo' })
    expect(exportDiff([ann])).toMatch(/^# Plan Feedback\n/)
  })
})
