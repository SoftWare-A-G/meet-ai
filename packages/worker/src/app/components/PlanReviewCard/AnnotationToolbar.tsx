import { useState, useEffect, useCallback, useRef } from 'react'
import clsx from 'clsx'
import type { AnnotationType } from './annotations'

type ToolbarMode = 'menu' | 'input'

type AnnotationToolbarProps = {
  selectionRect: DOMRect | null
  containerRect: DOMRect | null
  onSubmit: (type: AnnotationType, text?: string) => void
  onClose: () => void
}

export default function AnnotationToolbar({
  selectionRect,
  containerRect,
  onSubmit,
  onClose,
}: AnnotationToolbarProps) {
  const [mode, setMode] = useState<ToolbarMode>('menu')
  const [inputType, setInputType] = useState<AnnotationType>('COMMENT')
  const [inputText, setInputText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)

  // Reset state when selection changes
  useEffect(() => {
    setMode('menu')
    setInputType('COMMENT')
    setInputText('')
  }, [selectionRect])

  // Focus textarea when entering input mode
  useEffect(() => {
    if (mode === 'input') {
      textareaRef.current?.focus()
    }
  }, [mode])

  // Close on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  // Keyboard: typing in menu mode auto-opens comment input
  useEffect(() => {
    if (mode !== 'menu') return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      // Printable character — open comment input and pass the key through
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setInputType('COMMENT')
        setInputText(e.key)
        setMode('input')
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [mode, onClose])

  const handleAction = useCallback(
    (type: AnnotationType) => {
      if (type === 'DELETION') {
        onSubmit('DELETION')
        return
      }
      setInputType(type)
      setMode('input')
    },
    [onSubmit],
  )

  const handleSubmitInput = useCallback(() => {
    const trimmed = inputText.trim()
    if (!trimmed) return
    onSubmit(inputType, trimmed)
  }, [inputText, inputType, onSubmit])

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmitInput()
      }
      if (e.key === 'Escape') {
        if (mode === 'input') {
          setMode('menu')
          setInputText('')
        } else {
          onClose()
        }
      }
    },
    [handleSubmitInput, mode, onClose],
  )

  if (!selectionRect || !containerRect) return null

  // Position the toolbar above the selection, centered horizontally
  const left = Math.max(
    0,
    Math.min(
      selectionRect.left - containerRect.left + selectionRect.width / 2,
      containerRect.width - 80,
    ),
  )
  const top = selectionRect.top - containerRect.top - 8

  const placeholder =
    inputType === 'COMMENT'
      ? 'Add a comment...'
      : 'Suggest replacement text...'

  return (
    <div
      ref={toolbarRef}
      className="absolute z-50 -translate-x-1/2 -translate-y-full"
      style={{ left, top }}
    >
      {mode === 'menu' ? (
        <div className="flex items-center gap-0.5 rounded-lg border border-zinc-600 bg-zinc-800 px-1 py-0.5 shadow-lg">
          {/* Comment */}
          <button
            type="button"
            onClick={() => handleAction('COMMENT')}
            className="rounded p-1.5 text-zinc-300 hover:bg-zinc-700 hover:text-purple-400 cursor-pointer transition-colors"
            title="Add comment"
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zm-4 0H9v2h2V9z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          {/* Delete */}
          <button
            type="button"
            onClick={() => handleAction('DELETION')}
            className="rounded p-1.5 text-zinc-300 hover:bg-zinc-700 hover:text-red-400 cursor-pointer transition-colors"
            title="Mark for deletion"
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          {/* Replace */}
          <button
            type="button"
            onClick={() => handleAction('REPLACEMENT')}
            className="rounded p-1.5 text-zinc-300 hover:bg-zinc-700 hover:text-yellow-400 cursor-pointer transition-colors"
            title="Suggest replacement"
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="w-64 rounded-lg border border-zinc-600 bg-zinc-800 shadow-lg">
          <div className="flex items-center gap-1.5 px-2 pt-2">
            <span
              className={clsx(
                'rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase',
                inputType === 'COMMENT'
                  ? 'bg-purple-500/20 text-purple-400'
                  : 'bg-yellow-500/20 text-yellow-400',
              )}
            >
              {inputType === 'COMMENT' ? 'Comment' : 'Replace'}
            </span>
          </div>
          <div className="p-2">
            <textarea
              ref={textareaRef}
              className="w-full resize-none rounded border border-zinc-600 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
              placeholder={placeholder}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleInputKeyDown}
              rows={2}
            />
            <div className="mt-1.5 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setMode('menu')
                  setInputText('')
                }}
                className="text-xs text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!inputText.trim()}
                onClick={handleSubmitInput}
                className={clsx(
                  'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                  inputText.trim()
                    ? 'bg-purple-600 text-white cursor-pointer hover:bg-purple-500'
                    : 'bg-zinc-700 text-zinc-500 cursor-not-allowed',
                )}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
