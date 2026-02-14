import { useEffect, useRef } from 'react'
import clsx from 'clsx'
import { hashColor, ensureSenderContrast } from '../../lib/colors'
import { formatTime } from '../../lib/dates'
import { renderMarkdown, highlightCode } from '../../lib/markdown'

type MessageProps = {
  sender: string
  content: string
  color?: string
  timestamp?: string
  tempId?: string
  status?: 'sent' | 'pending' | 'failed'
  onRetry?: () => void
  attachmentCount?: number
}

export default function Message({ sender, content, color, timestamp, tempId, status = 'sent', onRetry, attachmentCount }: MessageProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const senderColor = color ? ensureSenderContrast(color) : hashColor(sender)

  const timeText = status === 'pending' ? 'sending' : status === 'failed' ? 'failed' : formatTime(timestamp)

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.innerHTML = renderMarkdown(content)
      highlightCode(contentRef.current)
    }
  }, [content])

  return (
    <div className={clsx('rounded-md px-2 py-1.5 text-sm break-words hover:bg-white/[0.08]', status === 'pending' && 'opacity-50', status === 'failed' && 'opacity-70')} data-temp-id={tempId} data-content={tempId ? content : undefined}>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className="font-bold text-sm" style={{ color: senderColor }}>{sender}</span>
          <span className="text-[11px] text-[#8b8fa3]">
            {timeText}
            {status === 'pending' && ' \u23F3'}
            {status === 'failed' && ' \u274C'}
          </span>
          {status === 'failed' && onRetry && (
            <span className="inline text-[11px] text-primary cursor-pointer ml-1.5 underline" onClick={onRetry}>retry</span>
          )}
        </div>
        <div className="msg-content" ref={contentRef} />
        {attachmentCount && attachmentCount > 0 ? (
          <div className="text-xs opacity-60 mt-1">
            {'\u{1F4CE}'} {attachmentCount} attachment{attachmentCount > 1 ? 's' : ''}
          </div>
        ) : null}
      </div>
    </div>
  )
}
