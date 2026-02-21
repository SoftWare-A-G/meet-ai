import { useState, useCallback, useMemo, useRef } from 'react'
import clsx from 'clsx'
import { formatTime } from '../../lib/dates'
import { useAnnotations } from '../../hooks/useAnnotations'
import { useHighlighter, type SelectionInfo } from '../../hooks/useHighlighter'
import type { AnnotationType } from './annotations'
import AnnotationToolbar from './AnnotationToolbar'
import AnnotationPanel from './AnnotationPanel'
import { exportDiff } from './exportDiff'

type PlanReviewCardProps = {
  content: string
  timestamp?: string
  reviewId: string
  status?: 'pending' | 'approved' | 'denied' | 'expired'
  feedback?: string
  onDecide: (reviewId: string, approved: boolean, feedback?: string) => void
}

const COLLAPSE_LINE_COUNT = 10
const PURPLE = '#8b5cf6'

let blockCounter = 0

function renderMarkdown(md: string): string {
  blockCounter = 0

  const nextBlockId = () => `block-${blockCounter++}`

  let html = md
    // Code blocks (fenced)
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) => {
      const id = nextBlockId()
      return `<pre class="plan-code-block" data-block-id="${id}"><code>${code.replace(/</g, '&lt;').replace(/>/g, '&gt;').trimEnd()}</code></pre>`
    })
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="plan-inline-code">$1</code>')
    // Headings
    .replace(/^#### (.+)$/gm, (_m, text) => `<h4 class="plan-h4" data-block-id="${nextBlockId()}">${text}</h4>`)
    .replace(/^### (.+)$/gm, (_m, text) => `<h3 class="plan-h3" data-block-id="${nextBlockId()}">${text}</h3>`)
    .replace(/^## (.+)$/gm, (_m, text) => `<h2 class="plan-h2" data-block-id="${nextBlockId()}">${text}</h2>`)
    .replace(/^# (.+)$/gm, (_m, text) => `<h1 class="plan-h1" data-block-id="${nextBlockId()}">${text}</h1>`)
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Unordered lists
    .replace(/^[-*] (.+)$/gm, (_m, text) => `<li class="plan-li" data-block-id="${nextBlockId()}">${text}</li>`)
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, (_m, text) => `<li class="plan-li-ordered" data-block-id="${nextBlockId()}">${text}</li>`)
    // Horizontal rules
    .replace(/^---$/gm, '<hr class="plan-hr" />')
    // Paragraphs: wrap remaining non-tag lines
    .split('\n')
    .map(line => {
      const trimmed = line.trim()
      if (!trimmed) return ''
      if (trimmed.startsWith('<')) return line
      return `<p class="plan-p" data-block-id="${nextBlockId()}">${line}</p>`
    })
    .join('\n')
  return html
}

function findBlockId(node: Node): string {
  let el: Element | null = node instanceof Element ? node : node.parentElement
  while (el) {
    const blockId = el.getAttribute('data-block-id')
    if (blockId) return blockId
    el = el.parentElement
  }
  return 'block-unknown'
}

type SelectionState = {
  info: SelectionInfo
  rect: DOMRect
  blockId: string
}

// Store highlight metadata keyed by annotation ID
type HighlightMetaMap = Map<string, SelectionInfo['meta']>

export default function PlanReviewCard({
  content,
  timestamp,
  reviewId,
  status = 'pending',
  feedback: existingFeedback,
  onDecide,
}: PlanReviewCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [showFeedbackInput, setShowFeedbackInput] = useState(false)
  const [feedbackText, setFeedbackText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [selection, setSelection] = useState<SelectionState | null>(null)
  const [showAnnotationPanel, setShowAnnotationPanel] = useState(false)

  const contentRef = useRef<HTMLDivElement>(null)
  const highlightMetaRef = useRef<HighlightMetaMap>(new Map())

  const {
    annotations,
    addAnnotation,
    updateAnnotation,
    removeAnnotation,
  } = useAnnotations()

  const isPending = status === 'pending'

  const handleSelect = useCallback((info: SelectionInfo) => {
    if (!isPending) return
    const range = info.range
    const blockId = findBlockId(range.startContainer)
    const rect = range.getBoundingClientRect()
    setSelection({ info, rect, blockId })
  }, [isPending])

  const { addHighlight, removeHighlight } = useHighlighter({
    containerRef: contentRef,
    onSelect: handleSelect,
    enabled: isPending,
  })

  const handleToolbarClose = useCallback(() => {
    setSelection(null)
    window.getSelection()?.removeAllRanges()
  }, [])

  const handleToolbarSubmit = useCallback(
    (type: AnnotationType, text?: string) => {
      if (!selection) return

      const annotation = addAnnotation({
        blockId: selection.blockId,
        startOffset: selection.info.range.startOffset,
        endOffset: selection.info.range.endOffset,
        type,
        originalText: selection.info.text,
        text,
      })

      // Store meta for highlight rendering and add visual highlight
      highlightMetaRef.current.set(annotation.id, selection.info.meta)
      addHighlight(annotation.id, selection.info.meta, type)

      // Auto-show annotation panel when first annotation is created
      if (annotations.length === 0) {
        setShowAnnotationPanel(true)
      }

      handleToolbarClose()
    },
    [selection, addAnnotation, addHighlight, annotations.length, handleToolbarClose],
  )

  const handleAnnotationEdit = useCallback(
    (id: string, updates: { text?: string; type?: AnnotationType }) => {
      updateAnnotation(id, updates)
      // If type changed, update highlight styling
      if (updates.type) {
        const meta = highlightMetaRef.current.get(id)
        if (meta) {
          removeHighlight(id)
          addHighlight(id, meta, updates.type)
        }
      }
    },
    [updateAnnotation, removeHighlight, addHighlight],
  )

  const handleAnnotationDelete = useCallback(
    (id: string) => {
      removeAnnotation(id)
      removeHighlight(id)
      highlightMetaRef.current.delete(id)
    },
    [removeAnnotation, removeHighlight],
  )

  const lines = content.split('\n')
  const needsCollapse = lines.length > COLLAPSE_LINE_COUNT
  const visibleContent = expanded || !needsCollapse
    ? content
    : lines.slice(0, COLLAPSE_LINE_COUNT).join('\n')

  const renderedHtml = useMemo(() => renderMarkdown(visibleContent), [visibleContent])

  const decided = status === 'approved' || status === 'denied' || status === 'expired'

  const handleApprove = useCallback(() => {
    if (decided || submitting) return
    setSubmitting(true)
    onDecide(reviewId, true)
  }, [decided, submitting, onDecide, reviewId])

  const handleRequestChanges = useCallback(() => {
    if (decided || submitting) return
    // If there are annotations, submit structured feedback immediately
    if (annotations.length > 0) {
      const feedback = exportDiff(annotations)
      setSubmitting(true)
      onDecide(reviewId, false, feedback)
      return
    }
    // Otherwise, show the textarea for manual feedback
    setShowFeedbackInput(true)
  }, [decided, submitting, annotations, onDecide, reviewId])

  const handleSubmitFeedback = useCallback(() => {
    if (decided || submitting || !feedbackText.trim()) return
    setSubmitting(true)
    onDecide(reviewId, false, feedbackText.trim())
  }, [decided, submitting, feedbackText, onDecide, reviewId])

  const borderColor = status === 'approved'
    ? '#22c55e'
    : status === 'denied'
      ? '#ef4444'
      : status === 'expired'
        ? '#8b8fa3'
        : PURPLE

  const bgColor = status === 'approved'
    ? 'rgba(34, 197, 94, 0.06)'
    : status === 'denied'
      ? 'rgba(239, 68, 68, 0.06)'
      : status === 'expired'
        ? 'rgba(139, 143, 163, 0.06)'
        : `${PURPLE}0F`

  const containerRect = contentRef.current?.getBoundingClientRect() ?? null

  return (
    <div
      className="rounded-md border-l-2 px-3 py-2.5 text-sm"
      style={{ borderColor, backgroundColor: bgColor }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        {status === 'approved' && (
          <svg className="w-4 h-4 text-[#22c55e] shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        )}
        {status === 'denied' && (
          <svg className="w-4 h-4 text-[#ef4444] shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        )}
        <span className="font-bold text-sm" style={{ color: borderColor }}>
          {status === 'approved' ? 'Plan approved' : status === 'denied' ? 'Changes requested' : status === 'expired' ? 'Plan review expired' : 'Plan review'}
        </span>
        {timestamp && (
          <span className="text-xs text-[#8b8fa3]">{formatTime(timestamp)}</span>
        )}
        {/* Annotation panel toggle — only show for pending plans */}
        {isPending && (
          <button
            type="button"
            onClick={() => setShowAnnotationPanel(s => !s)}
            className="ml-auto flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-zinc-400 hover:text-purple-400 hover:bg-zinc-700/50 cursor-pointer transition-colors"
            title={showAnnotationPanel ? 'Hide annotations' : 'Show annotations'}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zm-4 0H9v2h2V9z"
                clipRule="evenodd"
              />
            </svg>
            {annotations.length > 0 && (
              <span className="rounded-full bg-purple-600/30 px-1 text-[10px] text-purple-400 font-medium">
                {annotations.length}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Plan content — relative for toolbar positioning */}
      <div className="relative" ref={contentRef}>
        <div
          className="plan-markdown text-msg-text"
          dangerouslySetInnerHTML={{ __html: renderedHtml }}
        />

        {/* Floating annotation toolbar */}
        {selection && isPending && (
          <AnnotationToolbar
            selectionRect={selection.rect}
            containerRect={containerRect}
            onSubmit={handleToolbarSubmit}
            onClose={handleToolbarClose}
          />
        )}
      </div>

      {/* Show more / less toggle */}
      {needsCollapse && (
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="mt-1 text-xs cursor-pointer hover:underline"
          style={{ color: PURPLE }}
        >
          {expanded ? 'Show less' : `Show more (${lines.length - COLLAPSE_LINE_COUNT} more lines)`}
        </button>
      )}

      {/* Annotation panel */}
      {showAnnotationPanel && isPending && (
        <AnnotationPanel
          annotations={annotations}
          onEdit={handleAnnotationEdit}
          onDelete={handleAnnotationDelete}
        />
      )}

      {/* Feedback display for denied plans */}
      {status === 'denied' && existingFeedback && (
        <div className="mt-2 rounded border border-[#ef4444]/20 bg-[#ef4444]/[0.06] px-2.5 py-2 text-sm text-msg-text">
          <span className="text-xs font-medium text-[#ef4444]">Feedback:</span>
          <p className="mt-0.5">{existingFeedback}</p>
        </div>
      )}

      {/* Feedback textarea for request changes (only when no annotations) */}
      {showFeedbackInput && !decided && (
        <div className="mt-2">
          <textarea
            className="w-full rounded border border-border bg-transparent px-2.5 py-2 text-sm text-msg-text placeholder:text-[#8b8fa3] focus:outline-none focus:border-[#ef4444]/60 resize-y min-h-[60px]"
            placeholder="Describe what changes you'd like..."
            value={feedbackText}
            onChange={e => setFeedbackText(e.target.value)}
            rows={3}
            autoFocus
          />
        </div>
      )}

      {/* Action buttons */}
      {!decided && (
        <div className="mt-3 flex items-center gap-2 justify-end">
          {showFeedbackInput ? (
            <>
              <button
                type="button"
                onClick={() => { setShowFeedbackInput(false); setFeedbackText('') }}
                className="rounded-lg px-3 py-1.5 text-sm text-[#8b8fa3] hover:text-msg-text cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!feedbackText.trim() || submitting}
                onClick={handleSubmitFeedback}
                className={clsx(
                  'rounded-lg px-4 py-1.5 text-sm font-medium transition-all',
                  feedbackText.trim() && !submitting
                    ? 'bg-[#ef4444] text-white cursor-pointer hover:brightness-110'
                    : 'bg-[#ef4444]/20 text-[#ef4444]/40 cursor-not-allowed',
                )}
              >
                {submitting ? 'Submitting...' : 'Submit feedback'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={submitting}
                onClick={handleRequestChanges}
                className={clsx(
                  'rounded-lg border px-3 py-1.5 text-sm font-medium transition-all',
                  submitting
                    ? 'border-border text-[#8b8fa3] cursor-not-allowed opacity-40'
                    : 'border-[#ef4444]/40 text-[#ef4444] cursor-pointer hover:bg-[#ef4444]/[0.08] hover:border-[#ef4444]/60',
                )}
              >
                {annotations.length > 0
                  ? `Request changes (${annotations.length})`
                  : 'Request changes'}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleApprove}
                className={clsx(
                  'rounded-lg px-4 py-1.5 text-sm font-medium transition-all',
                  submitting
                    ? 'bg-[#22c55e]/20 text-[#22c55e]/40 cursor-not-allowed'
                    : 'bg-[#22c55e] text-white cursor-pointer hover:brightness-110',
                )}
              >
                {submitting ? 'Approving...' : 'Approve'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Markdown + highlight styles */}
      <style>{`
        .plan-markdown .plan-h1 { font-size: 1.25rem; font-weight: 700; margin: 0.75rem 0 0.5rem; }
        .plan-markdown .plan-h2 { font-size: 1.1rem; font-weight: 700; margin: 0.625rem 0 0.375rem; }
        .plan-markdown .plan-h3 { font-size: 1rem; font-weight: 600; margin: 0.5rem 0 0.25rem; }
        .plan-markdown .plan-h4 { font-size: 0.9rem; font-weight: 600; margin: 0.375rem 0 0.25rem; }
        .plan-markdown .plan-p { margin: 0.25rem 0; line-height: 1.5; }
        .plan-markdown .plan-li { margin-left: 1.25rem; list-style-type: disc; display: list-item; line-height: 1.5; }
        .plan-markdown .plan-li-ordered { margin-left: 1.25rem; list-style-type: decimal; display: list-item; line-height: 1.5; }
        .plan-markdown .plan-hr { border: none; border-top: 1px solid rgba(139, 143, 163, 0.2); margin: 0.5rem 0; }
        .plan-markdown .plan-code-block {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 6px;
          padding: 0.75rem;
          margin: 0.5rem 0;
          overflow-x: auto;
          font-size: 0.8rem;
          line-height: 1.4;
        }
        .plan-markdown .plan-inline-code {
          background: rgba(0, 0, 0, 0.15);
          border-radius: 3px;
          padding: 0.125rem 0.375rem;
          font-size: 0.85em;
        }
        .highlight-deletion {
          background-color: rgba(239, 68, 68, 0.2);
          text-decoration: line-through;
          text-decoration-color: #ef4444;
        }
        .highlight-replacement {
          background-color: rgba(234, 179, 8, 0.2);
          border-bottom: 2px solid #eab308;
        }
        .highlight-comment {
          background-color: rgba(139, 92, 246, 0.2);
          border-bottom: 2px solid #8b5cf6;
        }
      `}</style>
    </div>
  )
}
