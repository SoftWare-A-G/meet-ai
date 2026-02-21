import { useRef, useCallback, useEffect } from 'react'
import type { RefObject } from 'react'
import Highlighter from '@plannotator/web-highlighter'
import { HIGHLIGHT_CLASSES, type AnnotationType } from '../components/PlanReviewCard/annotations'

type HighlightMeta = {
  startMeta: { parentTagName: string; parentIndex: number; textOffset: number }
  endMeta: { parentTagName: string; parentIndex: number; textOffset: number }
}

export type SelectionInfo = {
  text: string
  range: Range
  meta: HighlightMeta
}

type UseHighlighterOptions = {
  containerRef: RefObject<HTMLElement | null>
  onSelect?: (info: SelectionInfo) => void
  enabled?: boolean
}

export function useHighlighter({ containerRef, onSelect, enabled = true }: UseHighlighterOptions) {
  const highlighterRef = useRef<Highlighter | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container || !enabled) return

    const h = new Highlighter({
      $root: container,
      exceptSelectors: ['.plan-code-block', 'pre', 'code'],
      style: { className: 'highlight-annotation' },
    })

    // Don't auto-highlight on selection — we handle it manually
    // so we can ask the user what type of annotation to create
    h.hooks.Render.UUID.tap((id) => id as string)

    highlighterRef.current = h

    const handleMouseUp = () => {
      const selection = window.getSelection()
      if (!selection || selection.isCollapsed || !selection.rangeCount) return

      const range = selection.getRangeAt(0)
      if (!container.contains(range.commonAncestorContainer)) return

      const text = selection.toString().trim()
      if (!text) return

      // Get serializable position metadata from the range
      const source = h.fromRange(range)
      onSelect?.({
        text,
        range,
        meta: {
          startMeta: source.startMeta,
          endMeta: source.endMeta,
        },
      })

      // Remove the auto-created highlight — the annotation toolbar
      // will handle creating the styled highlight after the user picks a type
      h.remove(source.id)
    }

    container.addEventListener('mouseup', handleMouseUp)

    return () => {
      container.removeEventListener('mouseup', handleMouseUp)
      h.dispose()
      highlighterRef.current = null
    }
  }, [containerRef, onSelect, enabled])

  const addHighlight = useCallback(
    (id: string, meta: HighlightMeta, type: AnnotationType) => {
      const h = highlighterRef.current
      if (!h) return

      h.fromStore(meta.startMeta, meta.endMeta, '', id)
      // Apply type-specific class for styling
      h.addClass(HIGHLIGHT_CLASSES[type], id)
    },
    [],
  )

  const removeHighlight = useCallback((id: string) => {
    highlighterRef.current?.remove(id)
  }, [])

  const clearAllHighlights = useCallback(() => {
    highlighterRef.current?.removeAll()
  }, [])

  return { addHighlight, removeHighlight, clearAllHighlights }
}
