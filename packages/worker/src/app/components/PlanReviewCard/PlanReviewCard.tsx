import { useState, useCallback, useMemo, useRef, useEffect, memo } from 'react'
import clsx from 'clsx'
import DOMPurify from 'dompurify'
import { Renderer, parse } from 'marked'
import { formatTime } from '../../lib/dates'
import { useAnnotations } from '../../hooks/useAnnotations'
import { useHighlighter } from '../../hooks/useHighlighter'
import type { SelectionInfo } from '../../hooks/useHighlighter'
import type { AnnotationType } from './annotations'
import ModeSwitcher from './ModeSwitcher'
import type { EditorMode } from './ModeSwitcher'
import AnnotationToolbar from './AnnotationToolbar'
import AnnotationPanel from './AnnotationPanel'
import ShikiCode from '../ShikiCode'
import { exportDiff } from './exportDiff'

type PlanReviewCardProps = {
  content: string
  timestamp?: string
  reviewId: string
  status?: 'pending' | 'approved' | 'denied' | 'expired'
  feedback?: string
  onDecide: (reviewId: string, approved: boolean, feedback?: string, permissionMode?: string) => void
  onDismiss?: (reviewId: string) => void
}

const PURPLE = '#8b5cf6'
const MARKER_ATTR = 'data-shiki-idx'

type Segment =
  | { type: 'html'; html: string }
  | { type: 'code'; code: string; lang: string; blockId: string }

function parsePlanMarkdown(md: string): Segment[] {
  let blockCounter = 0
  const nextBlockId = () => `block-${blockCounter++}`
  const codeBlocks: { code: string; lang: string; blockId: string }[] = []

  const renderer = new Renderer()

  // Only override code blocks — they need special handling for ShikiCode.
  // All other block types use marked's default renderers so inline formatting
  // (bold, italic, links, etc.) is processed correctly via parseInline().
  renderer.code = ({ text, lang }) => {
    const idx = codeBlocks.length
    const blockId = nextBlockId()
    codeBlocks.push({ code: text, lang: lang || 'text', blockId })
    return `<pre ${MARKER_ATTR}="${idx}"></pre>`
  }

  const rawHtml = parse(md, { breaks: true, renderer }).toString()

  // Post-process: add data-block-id and plan CSS classes to block elements.
  // This preserves marked's inline rendering while enabling annotation targeting.
  const processedHtml = rawHtml
    .replace(/<(h([1-6]))(\s|>)/g, (_m, tag, d, rest) =>
      `<${tag} class="plan-h${d}" data-block-id="${nextBlockId()}"${rest}`)
    .replace(/<p(\s|>)/g, (_m, rest) =>
      `<p class="plan-p" data-block-id="${nextBlockId()}"${rest}`)
    .replace(/<li(\s|>)/g, (_m, rest) =>
      `<li data-block-id="${nextBlockId()}"${rest}`)
    .replace(/<hr\s*\/?>/g, '<hr class="plan-hr" />')

  const html = DOMPurify.sanitize(processedHtml, {
    ADD_ATTR: [MARKER_ATTR, 'data-block-id'],
  })

  if (codeBlocks.length === 0) {
    return [{ type: 'html', html }]
  }

  const markerRegex = new RegExp(
    `<pre\\s+${MARKER_ATTR}="(\\d+)"\\s*>\\s*</pre>`,
    'g',
  )

  const segments: Segment[] = []
  let lastIndex = 0

  for (const match of html.matchAll(markerRegex)) {
    const before = html.slice(lastIndex, match.index)
    if (before) {
      segments.push({ type: 'html', html: before })
    }
    const idx = parseInt(match[1], 10)
    segments.push({ type: 'code', ...codeBlocks[idx] })
    lastIndex = (match.index ?? 0) + match[0].length
  }

  const after = html.slice(lastIndex)
  if (after) {
    segments.push({ type: 'html', html: after })
  }

  return segments
}

function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) % 0x7fffffff
  }
  return hash.toString(36)
}

/** Memoised so that dangerouslySetInnerHTML DOM nodes survive parent re-renders. */
const PlanMarkdownContent = memo(function PlanMarkdownContent({ segments }: { segments: Segment[] }) {
  return (
    <div className="plan-markdown text-msg-text">
      {segments.map((seg, i) =>
        seg.type === 'code' ? (
          <div key={i} className="plan-code-block" data-block-id={seg.blockId}>
            <ShikiCode code={seg.code} lang={seg.lang} />
          </div>
        ) : (
          <div key={i} dangerouslySetInnerHTML={{ __html: seg.html }} />
        ),
      )}
    </div>
  )
})

export default function PlanReviewCard({
  content,
  timestamp,
  reviewId,
  status = 'pending',
  feedback: existingFeedback,
  onDecide,
  onDismiss,
}: PlanReviewCardProps) {
  const [showFeedbackInput, setShowFeedbackInput] = useState(false)
  const [feedbackText, setFeedbackText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [selection, setSelection] = useState<SelectionInfo | null>(null)
  const [showAnnotationPanel, setShowAnnotationPanel] = useState(false)
  const [showGlobalInput, setShowGlobalInput] = useState(false)
  const [globalText, setGlobalText] = useState('')
  const [permissionMode, setPermissionMode] = useState<'default' | 'acceptEdits' | 'bypassPermissions'>('default')
  const [editorMode, setEditorMode] = useState<EditorMode>('selection')

  const contentRef = useRef<HTMLDivElement>(null)

  const contentHash = useMemo(() => simpleHash(content), [content])

  const {
    annotations,
    pendingRemovals,
    addAnnotation,
    updateAnnotation,
    removeAnnotation,
    undoRemoval,
  } = useAnnotations(reviewId, contentHash)

  const isPending = status === 'pending'

  const handleSelect = useCallback((info: SelectionInfo) => {
    if (!isPending) return
    setSelection(info)
  }, [isPending])

  const { addHighlight, removeHighlight } = useHighlighter({
    containerRef: contentRef,
    onSelect: handleSelect,
    enabled: isPending,
  })

  // Re-apply highlights from persisted annotations on mount
  useEffect(() => {
    if (annotations.length === 0) return
    requestAnimationFrame(() => {
      for (const ann of annotations) {
        addHighlight(ann.id, ann.type, ann.blockId, ann.startOffset, ann.endOffset)
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // only on mount

  const handleToolbarClose = useCallback(() => {
    setSelection(null)
    // Defer clearing the browser selection so it doesn't interfere with a
    // new selection that may already be starting (mousedown fires before mouseup).
    requestAnimationFrame(() => {
      window.getSelection()?.removeAllRanges()
    })
  }, [])

  const handleGlobalSubmit = useCallback(() => {
    const trimmed = globalText.trim()
    if (!trimmed) return

    addAnnotation({
      blockId: '__global__',
      startOffset: 0,
      endOffset: 0,
      type: 'GLOBAL_COMMENT',
      originalText: '',
      text: trimmed,
    })

    setGlobalText('')
    setShowGlobalInput(false)

    if (!showAnnotationPanel) {
      setShowAnnotationPanel(true)
    }
  }, [globalText, addAnnotation, showAnnotationPanel])

  const handleToolbarSubmit = useCallback(
    (type: AnnotationType, text?: string) => {
      if (!selection) return

      const annotation = addAnnotation({
        blockId: selection.blockId,
        startOffset: selection.startOffset,
        endOffset: selection.endOffset,
        type,
        originalText: selection.text,
        text,
      })

      addHighlight(annotation.id, type, selection.blockId, selection.startOffset, selection.endOffset)

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
        const ann = annotations.find(a => a.id === id)
        if (ann) {
          removeHighlight(id)
          addHighlight(id, updates.type, ann.blockId, ann.startOffset, ann.endOffset)
        }
      }
    },
    [updateAnnotation, annotations, removeHighlight, addHighlight],
  )

  const handleAnnotationDelete = useCallback(
    (id: string) => {
      removeAnnotation(id)
      removeHighlight(id)
    },
    [removeAnnotation, removeHighlight],
  )

  const handleAnnotationUndo = useCallback(
    (id: string) => {
      const pending = pendingRemovals.get(id)
      if (!pending) return

      undoRemoval(id)
      const { annotation: ann } = pending
      addHighlight(id, ann.type, ann.blockId, ann.startOffset, ann.endOffset)
    },
    [undoRemoval, pendingRemovals, addHighlight],
  )

  const segments = useMemo(() => parsePlanMarkdown(content), [content])

  const decided = status === 'approved' || status === 'denied' || status === 'expired'

  const handleApprove = useCallback(() => {
    if (decided || submitting) return
    setSubmitting(true)
    onDecide(reviewId, true, undefined, permissionMode)
  }, [decided, submitting, onDecide, reviewId, permissionMode])

  // Keyboard shortcuts: Cmd+Enter to approve
  useEffect(() => {
    if (!isPending) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        handleApprove()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isPending, handleApprove])

  const handleRequestChanges = useCallback(() => {
    if (decided || submitting) return
    // If there are annotations, submit structured feedback immediately
    if (annotations.length > 0) {
      const feedback = exportDiff(annotations)
      setSubmitting(true)
      onDecide(reviewId, false, feedback, permissionMode)
      return
    }
    // Otherwise, show the textarea for manual feedback
    setShowFeedbackInput(true)
  }, [decided, submitting, annotations, onDecide, reviewId, permissionMode])

  const handleSubmitFeedback = useCallback(() => {
    if (decided || submitting || !feedbackText.trim()) return
    setSubmitting(true)
    onDecide(reviewId, false, feedbackText.trim(), permissionMode)
  }, [decided, submitting, feedbackText, onDecide, reviewId, permissionMode])

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
        {/* Global comment button */}
        {isPending && (
          <button
            type="button"
            onClick={() => setShowGlobalInput(s => !s)}
            className="ml-auto flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-zinc-400 hover:text-blue-400 hover:bg-zinc-700/50 cursor-pointer transition-colors"
            title="Add global comment"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
              <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
            </svg>
          </button>
        )}
        {/* Annotation panel toggle — only show for pending plans */}
        {isPending && (
          <button
            type="button"
            onClick={() => setShowAnnotationPanel(s => !s)}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-zinc-400 hover:text-purple-400 hover:bg-zinc-700/50 cursor-pointer transition-colors"
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

      {/* Global comment input */}
      {showGlobalInput && isPending && (
        <div className="mb-2 rounded-md border border-blue-500/30 bg-blue-500/[0.06] p-2">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase bg-blue-500/20 text-blue-400">
              Global
            </span>
            <span className="text-[10px] text-zinc-500">Comment on the entire plan</span>
          </div>
          <textarea
            className="w-full resize-none rounded border border-zinc-600 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-blue-500/50 focus:outline-none"
            placeholder="Add feedback about the overall plan..."
            value={globalText}
            onChange={(e) => setGlobalText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleGlobalSubmit()
              }
              if (e.key === 'Escape') {
                setShowGlobalInput(false)
                setGlobalText('')
              }
            }}
            rows={2}
            autoFocus
          />
          <div className="mt-1.5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => { setShowGlobalInput(false); setGlobalText('') }}
              className="text-xs text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!globalText.trim()}
              onClick={handleGlobalSubmit}
              className={clsx(
                'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                globalText.trim()
                  ? 'bg-blue-600 text-white cursor-pointer hover:bg-blue-500'
                  : 'bg-zinc-700 text-zinc-500 cursor-not-allowed',
              )}
            >
              Add
            </button>
          </div>
        </div>
      )}

      {/* Mode switcher */}
      {isPending && (
        <ModeSwitcher mode={editorMode} onChange={setEditorMode} />
      )}

      {/* Plan content — relative for toolbar positioning */}
      <div className="relative" ref={contentRef}>
        <PlanMarkdownContent segments={segments} />

        {/* Floating annotation toolbar */}
        {selection && isPending && (
          <AnnotationToolbar
            selectionRect={selection.rect}
            containerRect={containerRect}
            onSubmit={handleToolbarSubmit}
            onClose={handleToolbarClose}
            editorMode={editorMode}
          />
        )}
      </div>

      {/* Annotation panel */}
      {showAnnotationPanel && isPending && (
        <AnnotationPanel
          annotations={annotations}
          pendingRemovals={pendingRemovals}
          onEdit={handleAnnotationEdit}
          onDelete={handleAnnotationDelete}
          onUndo={handleAnnotationUndo}
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
        <div className="mt-3 flex items-center gap-2 justify-between">
          {/* Dismiss — left side */}
          {onDismiss && (
            <button
              type="button"
              disabled={submitting}
              onClick={() => { setSubmitting(true); onDismiss(reviewId) }}
              className="text-xs text-[#8b8fa3] hover:text-msg-text cursor-pointer transition-colors"
            >
              Dismiss
            </button>
          )}
          {!onDismiss && <div />}
          <div className="flex items-center gap-2">
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
                {!decided && !showFeedbackInput && (
                  <select
                    value={permissionMode}
                    onChange={(e) => setPermissionMode(e.target.value as typeof permissionMode)}
                    className="rounded-lg border border-zinc-600 bg-zinc-800 px-2 py-1.5 text-xs text-zinc-300 cursor-pointer focus:outline-none focus:border-purple-500/50"
                  >
                    <option value="default">Default mode</option>
                    <option value="acceptEdits">Accept edits</option>
                    <option value="bypassPermissions">Full auto</option>
                  </select>
                )}
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
        </div>
      )}

      {/* Markdown + highlight styles */}
      <style>{`
        .plan-markdown .plan-h1 { font-size: 1.25rem; font-weight: 700; margin: 0.75rem 0 0.5rem; }
        .plan-markdown .plan-h2 { font-size: 1.1rem; font-weight: 700; margin: 0.625rem 0 0.375rem; }
        .plan-markdown .plan-h3 { font-size: 1rem; font-weight: 600; margin: 0.5rem 0 0.25rem; }
        .plan-markdown .plan-h4 { font-size: 0.9rem; font-weight: 600; margin: 0.375rem 0 0.25rem; }
        .plan-markdown .plan-p { margin: 0.25rem 0; line-height: 1.5; }
        .plan-markdown ul { margin-left: 1.25rem; list-style-type: disc; }
        .plan-markdown ol { margin-left: 1.25rem; list-style-type: decimal; }
        .plan-markdown li { line-height: 1.5; }
        .plan-markdown .plan-hr { border: none; border-top: 1px solid rgba(139, 143, 163, 0.2); margin: 0.5rem 0; }
        .plan-markdown table { width: 100%; border-collapse: collapse; margin: 0.5rem 0; font-size: 0.85em; }
        .plan-markdown th { text-align: left; font-weight: 600; padding: 0.375rem 0.75rem; border-bottom: 1px solid rgba(139, 143, 163, 0.3); }
        .plan-markdown td { padding: 0.375rem 0.75rem; border-bottom: 1px solid rgba(139, 143, 163, 0.1); }
        .plan-markdown tr:last-child td { border-bottom: none; }
        .plan-markdown th[align="right"], .plan-markdown td[align="right"] { text-align: right; }
        .plan-markdown th[align="center"], .plan-markdown td[align="center"] { text-align: center; }
        .plan-markdown .plan-code-block {
          margin: 0.5rem 0;
          border-radius: 6px;
          overflow: hidden;
        }
        .plan-markdown .plan-code-block .shiki {
          padding: 0.75rem;
          margin: 0;
          font-size: 0.8rem;
          line-height: 1.4;
          overflow-x: auto;
        }
        .plan-markdown .plan-code-block pre:not(.shiki) {
          background: rgba(0, 0, 0, 0.2);
          padding: 0.75rem;
          font-size: 0.8rem;
          line-height: 1.4;
          overflow-x: auto;
        }
        .plan-markdown code:not(pre code) {
          background: rgba(0, 0, 0, 0.15);
          border-radius: 3px;
          padding: 0.125rem 0.375rem;
          font-size: 0.85em;
        }
        ::highlight(plan-highlight-deletion) {
          background-color: rgba(239, 68, 68, 0.2);
          text-decoration: line-through;
          text-decoration-color: #ef4444;
        }
        ::highlight(plan-highlight-replacement) {
          background-color: rgba(234, 179, 8, 0.2);
        }
        ::highlight(plan-highlight-comment) {
          background-color: rgba(139, 92, 246, 0.2);
        }
        ::highlight(plan-highlight-insertion) {
          background-color: rgba(16, 185, 129, 0.2);
        }
        .plan-markdown ::selection {
          background-color: rgba(139, 92, 246, 0.35);
        }
      `}</style>
    </div>
  )
}
