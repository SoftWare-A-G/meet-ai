import { useEffect, useRef } from 'hono/jsx/dom'
import { hashColor, darkenForAvatar, resolveColor, ensureSenderContrast } from '../../../lib/colors'
import { contrastRatio } from '../../../lib/theme'
import { renderMarkdown, highlightCode } from '../../../lib/markdown'

type MessageProps = {
  sender: string
  content: string
  color?: string
  timestamp?: string
  tempId?: string
  status?: 'sent' | 'pending' | 'failed'
  onRetry?: () => void
}

function escapeHtml(str: string): string {
  const d = document.createElement('div')
  d.textContent = str
  return d.innerHTML
}

function formatTime(isoStr?: string): string {
  if (!isoStr) return ''
  try {
    const d = new Date(isoStr)
    if (isNaN(d.getTime())) return ''
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
}

export default function Message({ sender, content, color, timestamp, tempId, status = 'sent', onRetry }: MessageProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const senderColor = color ? ensureSenderContrast(color) : hashColor(sender)
  const avatarBg = color ? ensureSenderContrast(color) : darkenForAvatar(sender)
  const initials = sender.slice(0, 2).toUpperCase()
  const resolvedAvatarBg = resolveColor(avatarBg)
  const avatarText = contrastRatio('#FFFFFF', resolvedAvatarBg) >= contrastRatio('#000000', resolvedAvatarBg) ? '#FFFFFF' : '#000000'

  const statusClass = status === 'pending' ? ' msg-pending' : status === 'failed' ? ' msg-failed' : ''
  const timeText = status === 'pending' ? 'sending' : status === 'failed' ? 'failed' : formatTime(timestamp)

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.innerHTML = renderMarkdown(content)
      highlightCode(contentRef.current)
    }
  }, [content])

  return (
    <div class={`msg${statusClass}`} data-temp-id={tempId} data-content={tempId ? content : undefined}>
      <div class="msg-avatar" style={`background:${avatarBg};color:${avatarText}`}>
        {escapeHtml(initials)}
      </div>
      <div class="msg-body">
        <div class="msg-header">
          <span class="msg-sender" style={`color:${senderColor}`}>{sender}</span>
          <span class="msg-time">{timeText}</span>
          {status === 'failed' && onRetry && (
            <span class="msg-retry" onClick={onRetry} style="display:inline">retry</span>
          )}
        </div>
        <div class="msg-content" ref={contentRef} />
      </div>
    </div>
  )
}
