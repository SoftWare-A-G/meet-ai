import { useRef, useCallback, useEffect } from 'react'
import type { RefObject } from 'react'
import type { AnnotationType } from '../components/PlanReviewCard/annotations'

export type SelectionInfo = {
  text: string
  rect: DOMRect
  blockId: string
  startOffset: number
  endOffset: number
}

type UseHighlighterOptions = {
  containerRef: RefObject<HTMLElement | null>
  onSelect?: (info: SelectionInfo) => void
  enabled?: boolean
}

/** Walk text nodes to get the character offset within a block's textContent. */
function getBlockOffset(block: Element, node: Node, offset: number): number {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT)
  let charOffset = 0
  let current: Node | null
  while ((current = walker.nextNode())) {
    if (current === node) return charOffset + offset
    charOffset += (current as Text).length
  }
  return charOffset
}

/** Create a Range from character offsets within a block's textContent. */
function createRangeFromOffsets(
  block: Element,
  startOffset: number,
  endOffset: number,
): Range | null {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT)
  const range = document.createRange()
  let charOffset = 0
  let startSet = false
  let current: Node | null
  while ((current = walker.nextNode())) {
    const len = (current as Text).length
    const end = charOffset + len
    if (!startSet && startOffset >= charOffset && startOffset <= end) {
      range.setStart(current, startOffset - charOffset)
      startSet = true
    }
    if (startSet && endOffset >= charOffset && endOffset <= end) {
      range.setEnd(current, endOffset - charOffset)
      return range
    }
    charOffset = end
  }
  return null
}

/** Find the closest ancestor with data-block-id. */
function findBlock(node: Node): Element | null {
  let el: Element | null = node instanceof Element ? node : node.parentElement
  while (el) {
    if (el.hasAttribute('data-block-id')) return el
    el = el.parentElement
  }
  return null
}

const HIGHLIGHT_NAMES: Record<AnnotationType, string> = {
  DELETION: 'plan-highlight-deletion',
  REPLACEMENT: 'plan-highlight-replacement',
  COMMENT: 'plan-highlight-comment',
}

type StoredHighlight = {
  type: AnnotationType
  blockId: string
  startOffset: number
  endOffset: number
}

export function useHighlighter({ containerRef, onSelect, enabled = true }: UseHighlighterOptions) {
  // Store highlight metadata keyed by annotation id (survives DOM recreation)
  const highlightsRef = useRef<Map<string, StoredHighlight>>(new Map())
  // Keep the latest onSelect in a ref so the mouseup listener always calls
  // the current callback without needing to re-register the event listener.
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  /** Recreate all Range objects from stored offsets and push to CSS.highlights. */
  const rebuildHighlights = useCallback(() => {
    if (typeof CSS === 'undefined' || !('highlights' in CSS)) return

    const container = containerRef.current
    const byType = new Map<AnnotationType, Range[]>()

    for (const h of highlightsRef.current.values()) {
      const block = container?.querySelector(`[data-block-id="${h.blockId}"]`)
      if (!block) continue
      const range = createRangeFromOffsets(block, h.startOffset, h.endOffset)
      if (!range) continue
      const arr = byType.get(h.type) || []
      arr.push(range)
      byType.set(h.type, arr)
    }

    for (const [type, name] of Object.entries(HIGHLIGHT_NAMES)) {
      const ranges = byType.get(type as AnnotationType) || []
      if (ranges.length) {
        ;(CSS as any).highlights.set(name, new (window as any).Highlight(...ranges))
      } else {
        ;(CSS as any).highlights.delete(name)
      }
    }
  }, [containerRef])

  useEffect(() => {
    const container = containerRef.current
    if (!container || !enabled) return

    const handleMouseUp = () => {
      const selection = window.getSelection()
      if (!selection || selection.isCollapsed || !selection.rangeCount) return

      const range = selection.getRangeAt(0)
      if (!container.contains(range.commonAncestorContainer)) return

      const text = selection.toString().trim()
      if (!text) return

      // Reject selections inside code blocks
      const ancestor = range.commonAncestorContainer
      const el = ancestor instanceof Element ? ancestor : ancestor.parentElement
      if (el?.closest('.plan-code-block, pre, code')) return

      const block = findBlock(range.startContainer)
      if (!block) return

      const rect = range.getBoundingClientRect()
      const blockId = block.getAttribute('data-block-id') || 'block-unknown'
      const startOffset = getBlockOffset(block, range.startContainer, range.startOffset)
      const endOffset = getBlockOffset(block, range.endContainer, range.endOffset)

      onSelectRef.current?.({ text, rect, blockId, startOffset, endOffset })
    }

    // Listen on document so mouseup is captured even when the cursor
    // ends outside the container (common during text drag-selection).
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [containerRef, enabled])

  // Clean up CSS highlights on unmount
  useEffect(() => {
    return () => {
      if (typeof CSS === 'undefined' || !('highlights' in CSS)) return
      for (const name of Object.values(HIGHLIGHT_NAMES)) {
        ;(CSS as any).highlights.delete(name)
      }
    }
  }, [])

  const addHighlight = useCallback(
    (id: string, type: AnnotationType, blockId: string, startOffset: number, endOffset: number) => {
      highlightsRef.current.set(id, { type, blockId, startOffset, endOffset })
      rebuildHighlights()
    },
    [rebuildHighlights],
  )

  const removeHighlight = useCallback(
    (id: string) => {
      highlightsRef.current.delete(id)
      rebuildHighlights()
    },
    [rebuildHighlights],
  )

  const clearAllHighlights = useCallback(() => {
    highlightsRef.current.clear()
    rebuildHighlights()
  }, [rebuildHighlights])

  return { addHighlight, removeHighlight, clearAllHighlights }
}
