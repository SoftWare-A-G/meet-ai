import { useState, useCallback } from 'react'
import clsx from 'clsx'
import {
  sortByPosition,
  ANNOTATION_COLORS,
  type Annotation,
  type AnnotationType,
} from './annotations'

type AnnotationPanelProps = {
  annotations: Annotation[]
  pendingRemovals: Map<string, { annotation: Annotation }>
  onEdit: (id: string, updates: { text?: string; type?: AnnotationType }) => void
  onDelete: (id: string) => void
  onUndo: (id: string) => void
}

const TYPE_LABELS: Record<AnnotationType, string> = {
  DELETION: 'Delete',
  REPLACEMENT: 'Replace',
  COMMENT: 'Comment',
  INSERTION: 'Insert',
  GLOBAL_COMMENT: 'Global',
}

function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function AnnotationCard({
  annotation,
  onEdit,
  onDelete,
}: {
  annotation: Annotation
  onEdit: (id: string, updates: { text?: string; type?: AnnotationType }) => void
  onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(annotation.text ?? '')
  const colors = ANNOTATION_COLORS[annotation.type]

  const handleSave = useCallback(() => {
    const trimmed = editText.trim()
    if (trimmed) {
      onEdit(annotation.id, { text: trimmed })
    }
    setEditing(false)
  }, [editText, annotation.id, onEdit])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSave()
      }
      if (e.key === 'Escape') {
        setEditing(false)
        setEditText(annotation.text ?? '')
      }
    },
    [handleSave, annotation.text],
  )

  return (
    <div className="rounded-md border border-zinc-700 bg-zinc-800/50 p-2.5">
      {/* Header: type badge + timestamp */}
      <div className="flex items-center justify-between mb-1.5">
        <span
          className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase"
          style={{ backgroundColor: colors.bg, color: colors.text }}
        >
          {TYPE_LABELS[annotation.type]}
        </span>
        <span className="text-[10px] text-zinc-500">
          {relativeTime(annotation.createdAt)}
        </span>
      </div>

      {/* Original text — skip for global comments */}
      {annotation.blockId !== '__global__' && (
        <div className="rounded bg-zinc-900 px-2 py-1.5 text-xs font-mono text-zinc-300 break-words mb-1.5">
          {annotation.originalText}
        </div>
      )}

      {/* Comment / replacement text */}
      {editing ? (
        <div className="mb-1.5">
          <textarea
            className="w-full resize-none rounded border border-zinc-600 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            autoFocus
          />
          <div className="mt-1 flex items-center gap-1.5 justify-end">
            <button
              type="button"
              onClick={() => {
                setEditing(false)
                setEditText(annotation.text ?? '')
              }}
              className="text-[10px] text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!editText.trim()}
              onClick={handleSave}
              className={clsx(
                'rounded px-2 py-0.5 text-[10px] font-medium transition-colors',
                editText.trim()
                  ? 'bg-purple-600 text-white cursor-pointer hover:bg-purple-500'
                  : 'bg-zinc-700 text-zinc-500 cursor-not-allowed',
              )}
            >
              Save
            </button>
          </div>
        </div>
      ) : annotation.text ? (
        <div className="text-xs text-zinc-400 mb-1.5 break-words">
          {annotation.type === 'REPLACEMENT' && (
            <span className="text-yellow-400/80 font-medium text-[10px] uppercase mr-1">
              To:
            </span>
          )}
          {annotation.text}
        </div>
      ) : null}

      {/* Action buttons */}
      <div className="flex items-center gap-2 justify-end">
        {annotation.type !== 'DELETION' && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-[10px] text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors"
          >
            Edit
          </button>
        )}
        <button
          type="button"
          onClick={() => onDelete(annotation.id)}
          className="text-[10px] text-zinc-500 hover:text-red-400 cursor-pointer transition-colors"
        >
          Remove
        </button>
      </div>
    </div>
  )
}

export default function AnnotationPanel({
  annotations,
  pendingRemovals,
  onEdit,
  onDelete,
  onUndo,
}: AnnotationPanelProps) {
  const [collapsed, setCollapsed] = useState(false)
  const sorted = sortByPosition(annotations)

  return (
    <div className="mt-2 rounded-md border border-zinc-700 bg-zinc-800/30">
      {/* Panel header */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center justify-between px-3 py-2 cursor-pointer hover:bg-zinc-700/30 transition-colors rounded-t-md"
      >
        <span className="text-xs font-medium text-zinc-300">
          Annotations
          {annotations.length > 0 && (
            <span className="ml-1.5 rounded-full bg-purple-600/30 px-1.5 py-0.5 text-[10px] text-purple-400">
              {annotations.length}
            </span>
          )}
        </span>
        <svg
          className={clsx(
            'w-3.5 h-3.5 text-zinc-500 transition-transform',
            collapsed && '-rotate-90',
          )}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {!collapsed && (
        <div className="px-3 pb-3 space-y-2">
          {sorted.length === 0 && pendingRemovals.size === 0 ? (
            <p className="py-3 text-center text-xs text-zinc-500">
              Select text in the plan to add annotations
            </p>
          ) : (
            sorted.map((ann) => (
              <AnnotationCard
                key={ann.id}
                annotation={ann}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))
          )}

          {/* Undo toasts for pending removals */}
          {Array.from(pendingRemovals).map(([id, { annotation }]) => (
            <div
              key={id}
              className="flex items-center justify-between rounded-md border border-zinc-700 bg-zinc-800/80 px-3 py-2"
            >
              <span className="text-xs text-zinc-400">
                Annotation removed
                <span className="ml-1 font-mono text-zinc-500 text-[10px]">
                  &ldquo;{annotation.originalText.length > 20
                    ? `${annotation.originalText.slice(0, 20)}…`
                    : annotation.originalText}&rdquo;
                </span>
              </span>
              <button
                type="button"
                onClick={() => onUndo(id)}
                className="text-xs font-medium text-purple-400 hover:text-purple-300 cursor-pointer transition-colors"
              >
                Undo
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
