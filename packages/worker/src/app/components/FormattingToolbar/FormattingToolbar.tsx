import type { RefObject } from 'react'
import { Tooltip } from '@base-ui/react/tooltip'
import { IconPaperclip, IconBold, IconItalic, IconCode, IconLink, IconSend } from '../../icons'

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

const tooltipPopupClass = "rounded bg-gray-900 px-2 py-1 text-xs text-white shadow-lg"

export default function FormattingToolbar({ textareaRef, onSend, onAttach }: FormattingToolbarProps) {
  const handleFormat = (fmt: string) => {
    if (textareaRef.current) applyFormat(textareaRef.current, fmt)
  }

  return (
    <Tooltip.Provider delay={600} closeDelay={0}>
      <div className="flex items-center gap-1 px-2 py-1 border-t border-border">
        {onAttach && (
          <Tooltip.Root>
            <Tooltip.Trigger
              aria-label="Attach file"
              className="bg-transparent border-none text-msg-text opacity-45 cursor-pointer p-1 rounded flex items-center justify-center hover:opacity-80 hover:bg-white/10"
              onMouseDown={preventBlur}
              onClick={onAttach}
            >
              <IconPaperclip size={18} />
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner sideOffset={8}>
                <Tooltip.Popup className={tooltipPopupClass}>Attach file</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        )}
        <Tooltip.Root>
          <Tooltip.Trigger
            aria-label="Bold"
            className="bg-transparent border-none text-msg-text opacity-45 cursor-pointer p-1 rounded flex items-center justify-center hover:opacity-80 hover:bg-white/10"
            onMouseDown={preventBlur}
            onTouchStart={preventBlur}
            onTouchEnd={() => handleFormat('bold')}
            onClick={() => handleFormat('bold')}
          >
            <IconBold size={18} />
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner sideOffset={8}>
              <Tooltip.Popup className={tooltipPopupClass}>Bold</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
        <Tooltip.Root>
          <Tooltip.Trigger
            aria-label="Italic"
            className="bg-transparent border-none text-msg-text opacity-45 cursor-pointer p-1 rounded flex items-center justify-center hover:opacity-80 hover:bg-white/10"
            onMouseDown={preventBlur}
            onTouchStart={preventBlur}
            onTouchEnd={() => handleFormat('italic')}
            onClick={() => handleFormat('italic')}
          >
            <IconItalic size={18} />
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner sideOffset={8}>
              <Tooltip.Popup className={tooltipPopupClass}>Italic</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
        <Tooltip.Root>
          <Tooltip.Trigger
            aria-label="Code"
            className="bg-transparent border-none text-msg-text opacity-45 cursor-pointer p-1 rounded flex items-center justify-center hover:opacity-80 hover:bg-white/10"
            onMouseDown={preventBlur}
            onTouchStart={preventBlur}
            onTouchEnd={() => handleFormat('code')}
            onClick={() => handleFormat('code')}
          >
            <IconCode size={18} />
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner sideOffset={8}>
              <Tooltip.Popup className={tooltipPopupClass}>Code</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
        <Tooltip.Root>
          <Tooltip.Trigger
            aria-label="Link"
            className="bg-transparent border-none text-msg-text opacity-45 cursor-pointer p-1 rounded flex items-center justify-center hover:opacity-80 hover:bg-white/10"
            onMouseDown={preventBlur}
            onTouchStart={preventBlur}
            onTouchEnd={() => handleFormat('link')}
            onClick={() => handleFormat('link')}
          >
            <IconLink size={18} />
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner sideOffset={8}>
              <Tooltip.Popup className={tooltipPopupClass}>Link</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
        <div className="flex-1" />
        <Tooltip.Root>
          <Tooltip.Trigger
            aria-label="Send"
            className="p-1 border-none rounded w-7 h-7 bg-active text-active-text cursor-pointer flex items-center justify-center shrink-0 hover:brightness-110"
            onMouseDown={preventBlur}
            onTouchStart={preventBlur}
            onTouchEnd={onSend}
            onClick={onSend}
          >
            <IconSend size={14} />
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner sideOffset={8}>
              <Tooltip.Popup className={tooltipPopupClass}>Send</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      </div>
    </Tooltip.Provider>
  )
}
