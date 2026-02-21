import { useState, useCallback, useMemo } from 'react'
import clsx from 'clsx'
import { formatTime } from '../../lib/dates'

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

function renderMarkdown(md: string): string {
  let html = md
    // Code blocks (fenced)
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) =>
      `<pre class="plan-code-block"><code>${code.replace(/</g, '&lt;').replace(/>/g, '&gt;').trimEnd()}</code></pre>`)
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="plan-inline-code">$1</code>')
    // Headings
    .replace(/^#### (.+)$/gm, '<h4 class="plan-h4">$1</h4>')
    .replace(/^### (.+)$/gm, '<h3 class="plan-h3">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="plan-h2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="plan-h1">$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Unordered lists
    .replace(/^[-*] (.+)$/gm, '<li class="plan-li">$1</li>')
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, '<li class="plan-li-ordered">$1</li>')
    // Horizontal rules
    .replace(/^---$/gm, '<hr class="plan-hr" />')
    // Paragraphs: wrap remaining non-tag lines
    .split('\n')
    .map(line => {
      const trimmed = line.trim()
      if (!trimmed) return ''
      if (trimmed.startsWith('<')) return line
      return `<p class="plan-p">${line}</p>`
    })
    .join('\n')
  return html
}

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
    setShowFeedbackInput(true)
  }, [decided, submitting])

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
      </div>

      {/* Plan content */}
      <div
        className="plan-markdown text-msg-text"
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
      />

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

      {/* Feedback display for denied plans */}
      {status === 'denied' && existingFeedback && (
        <div className="mt-2 rounded border border-[#ef4444]/20 bg-[#ef4444]/[0.06] px-2.5 py-2 text-sm text-msg-text">
          <span className="text-xs font-medium text-[#ef4444]">Feedback:</span>
          <p className="mt-0.5">{existingFeedback}</p>
        </div>
      )}

      {/* Feedback textarea for request changes */}
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
                Request changes
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

      {/* Markdown styles */}
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
      `}</style>
    </div>
  )
}
