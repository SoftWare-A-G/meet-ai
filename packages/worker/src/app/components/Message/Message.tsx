import { useEffect, useRef, useState, useCallback } from 'react'
import clsx from 'clsx'
import { hashColor, ensureSenderContrast } from '../../lib/colors'
import { formatTime } from '../../lib/dates'
import { renderMarkdown, highlightCode } from '../../lib/markdown'
import { IconCopy, IconCheck, IconShare } from '../../icons'

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
  const [copied, setCopied] = useState(false)

  const timeText = status === 'pending' ? 'sending' : status === 'failed' ? 'failed' : formatTime(timestamp)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [content])

  const handleShare = useCallback(() => {
    navigator.share({ text: content })
  }, [content])

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.innerHTML = renderMarkdown(content)
      highlightCode(contentRef.current)
    }
  }, [content])

  return (
    <div className={clsx('group rounded-md px-2 py-1.5 text-sm break-words hover:bg-white/[0.08]', status === 'pending' && 'opacity-50', status === 'failed' && 'opacity-70')} data-temp-id={tempId} data-content={tempId ? content : undefined}>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className="font-bold text-sm" style={{ color: senderColor }}>{sender}</span>
          <span className="text-[11px] text-[#8b8fa3]">
            {timeText}
            {status === 'pending' && ' \u23F3'}
            {status === 'failed' && ' \u274C'}
          </span>
          {status === 'sent' && (
            <span className="inline-flex items-center gap-3 opacity-0 group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={handleCopy}
                className="p-2 inline-flex items-center justify-center text-[#8b8fa3]/60 hover:text-[#8b8fa3] transition-colors cursor-pointer"
                title="Copy message"
              >
                {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
              </button>
              {typeof navigator !== 'undefined' && 'share' in navigator && (
                <button
                  type="button"
                  onClick={handleShare}
                  className="p-2 inline-flex items-center justify-center text-[#8b8fa3]/60 hover:text-[#8b8fa3] transition-colors cursor-pointer"
                  title="Share message"
                >
                  <IconShare size={14} />
                </button>
              )}
            </span>
          )}
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
