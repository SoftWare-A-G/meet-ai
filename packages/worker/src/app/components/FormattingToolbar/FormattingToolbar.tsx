import type { RefObject } from 'react'

type FormattingToolbarProps = {
  textareaRef: RefObject<HTMLTextAreaElement | null>
  onSend: () => void
  onAttach?: () => void
}

function applyFormat(textarea: HTMLTextAreaElement, fmt: string) {
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const text = textarea.value
  const selected = text.slice(start, end)
  let replacement: string
  switch (fmt) {
    case 'bold': { replacement = `**${selected || 'text'}**`; break }
    case 'italic': { replacement = `*${selected || 'text'}*`; break }
    case 'code': { replacement = selected.includes('\n') ? `\`\`\`\n${selected || 'code'}\n\`\`\`` : `\`${selected || 'code'}\``; break }
    case 'link': { replacement = `[${selected || 'text'}](url)`; break }
    default: { return }
  }
  textarea.value = text.slice(0, start) + replacement + text.slice(end)
  textarea.focus()
  const cursorPos = start + replacement.length
  textarea.setSelectionRange(cursorPos, cursorPos)
}

// Prevent button taps from stealing focus from the textarea.
// On mobile, mousedown/touchstart on a button blurs the textarea and dismisses the keyboard.
// preventDefault() keeps focus in the textarea so .focus() calls aren't needed post-blur.
const preventBlur = (e: { preventDefault: () => void }) => e.preventDefault()

export default function FormattingToolbar({ textareaRef, onSend, onAttach }: FormattingToolbarProps) {
  const handleFormat = (fmt: string) => {
    if (textareaRef.current) applyFormat(textareaRef.current, fmt)
  }

  return (
    <div className="flex items-center gap-1 px-2 py-1 border-t border-border">
      {onAttach && (
        <button type="button" className="bg-transparent border-none text-msg-text opacity-45 cursor-pointer p-1 rounded flex items-center justify-center hover:opacity-80 hover:bg-white/10" title="Attach file" onMouseDown={preventBlur} onTouchStart={preventBlur} onTouchEnd={onAttach} onClick={onAttach}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
        </button>
      )}
      <button type="button" className="bg-transparent border-none text-msg-text opacity-45 cursor-pointer p-1 rounded flex items-center justify-center hover:opacity-80 hover:bg-white/10" title="Bold" onMouseDown={preventBlur} onTouchStart={preventBlur} onTouchEnd={() => handleFormat('bold')} onClick={() => handleFormat('bold')}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8" /></svg>
      </button>
      <button type="button" className="bg-transparent border-none text-msg-text opacity-45 cursor-pointer p-1 rounded flex items-center justify-center hover:opacity-80 hover:bg-white/10" title="Italic" onMouseDown={preventBlur} onTouchStart={preventBlur} onTouchEnd={() => handleFormat('italic')} onClick={() => handleFormat('italic')}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" x2="10" y1="4" y2="4" /><line x1="14" x2="5" y1="20" y2="20" /><line x1="15" x2="9" y1="4" y2="20" /></svg>
      </button>
      <button type="button" className="bg-transparent border-none text-msg-text opacity-45 cursor-pointer p-1 rounded flex items-center justify-center hover:opacity-80 hover:bg-white/10" title="Code" onMouseDown={preventBlur} onTouchStart={preventBlur} onTouchEnd={() => handleFormat('code')} onClick={() => handleFormat('code')}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
      </button>
      <button type="button" className="bg-transparent border-none text-msg-text opacity-45 cursor-pointer p-1 rounded flex items-center justify-center hover:opacity-80 hover:bg-white/10" title="Link" onMouseDown={preventBlur} onTouchStart={preventBlur} onTouchEnd={() => handleFormat('link')} onClick={() => handleFormat('link')}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
      </button>
      <div className="flex-1" />
      <button type="button" className="p-1 border-none rounded w-7 h-7 bg-active text-active-text cursor-pointer flex items-center justify-center shrink-0 hover:brightness-110" title="Send" onMouseDown={preventBlur} onTouchStart={preventBlur} onTouchEnd={onSend} onClick={onSend}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" /><path d="m21.854 2.147-10.94 10.939" /></svg>
      </button>
    </div>
  )
}
