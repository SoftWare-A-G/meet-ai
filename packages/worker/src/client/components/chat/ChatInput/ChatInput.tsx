import { useRef, useCallback } from 'hono/jsx/dom'
import FormattingToolbar from '../FormattingToolbar'
import { useAutoResize } from '../../../hooks/useAutoResize'

type ChatInputProps = {
  roomName: string
  onSend: (content: string) => void
}

export default function ChatInput({ roomName, onSend }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { resize, reset } = useAutoResize(textareaRef)

  const handleSend = useCallback(() => {
    const el = textareaRef.current
    const content = el?.value.trim()
    if (!content || !el) return
    onSend(content)
    reset()
    // Re-focus immediately (best-effort before any re-render)
    el.focus()
    // Re-focus after the framework re-render settles, in case the DOM
    // reconciliation caused a blur. requestAnimationFrame fires before
    // the next paint and stays within the user-activation window on mobile.
    requestAnimationFrame(() => el.focus())
  }, [onSend, reset])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  return (
    <div class="chat-input-area">
      <div class="chat-input-box">
        <textarea
          ref={textareaRef}
          placeholder={`Message #${roomName}`}
          rows={1}
          onInput={resize}
          onKeyDown={handleKeyDown}
        />
        <FormattingToolbar textareaRef={textareaRef} onSend={handleSend} />
      </div>
    </div>
  )
}
