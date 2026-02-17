import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import clsx from 'clsx'
import { hashColor, ensureSenderContrast } from '../../lib/colors'
import { formatTime } from '../../lib/dates'
import { renderMarkdown, highlightCode } from '../../lib/markdown'
import { textToSpeech } from '../../lib/api'
import { IconCopy, IconCheck, IconShare, IconVolume, IconPlayerStop, IconLoader } from '../../icons'

type TtsState = 'idle' | 'loading' | 'playing'

type MessageProps = {
  sender: string
  content: string
  color?: string
  timestamp?: string
  tempId?: string
  status?: 'sent' | 'pending' | 'failed'
  onRetry?: () => void
  attachmentCount?: number
  voiceAvailable?: boolean
}

export default function Message({ sender, content, color, timestamp, tempId, status = 'sent', onRetry, attachmentCount, voiceAvailable }: MessageProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const senderColor = color ? ensureSenderContrast(color) : hashColor(sender)
  const [copied, setCopied] = useState(false)
  const [ttsState, setTtsState] = useState<TtsState>('idle')

  const timeText = status === 'failed' ? 'failed' : formatTime(timestamp)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [content])

  const handleShare = useCallback(() => {
    navigator.share({ text: content })
  }, [content])

  const handleTts = useCallback(async () => {
    if (ttsState === 'loading') return

    if (ttsState === 'playing') {
      audioRef.current?.pause()
      audioRef.current = null
      setTtsState('idle')
      return
    }

    setTtsState('loading')
    try {
      const audioData = await textToSpeech(content)
      const blob = new Blob([audioData], { type: 'audio/mpeg' })
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio
      audio.addEventListener('ended', () => {
        setTtsState('idle')
        audioRef.current = null
        URL.revokeObjectURL(url)
      })
      audio.addEventListener('error', () => {
        setTtsState('idle')
        audioRef.current = null
        URL.revokeObjectURL(url)
      })
      await audio.play()
      setTtsState('playing')
    } catch {
      setTtsState('idle')
    }
  }, [content, ttsState])

  // Cleanup audio on unmount
  useEffect(() => () => {
    audioRef.current?.pause()
    audioRef.current = null
  }, [])

  const html = useMemo(() => renderMarkdown(content), [content])

  useEffect(() => {
    if (contentRef.current) {
      highlightCode(contentRef.current)
    }
  }, [content])

  const canShare = typeof navigator !== 'undefined' && 'share' in navigator

  return (
    <div className={clsx('group relative rounded-md px-2 py-1.5 text-sm break-words hover:bg-white/[0.08]', status === 'pending' && 'opacity-50', status === 'failed' && 'border-l-2 border-red-500/50 bg-red-500/[0.04]')} data-temp-id={tempId} data-content={tempId ? content : undefined}>
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-bold text-sm" style={{ color: senderColor }}>{sender}</span>
          <span className={clsx('text-xs', status === 'failed' ? 'text-red-400/80' : 'text-[#8b8fa3]')}>
            {timeText}
            {status === 'failed' && ' \u274C'}
          </span>
          <span className={clsx('inline-flex items-center opacity-0 transition-opacity', status === 'sent' && 'group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100')}>
            <button
              type="button"
              onClick={handleCopy}
              className="p-2 inline-flex items-center justify-center text-[#8b8fa3]/60 hover:text-[#8b8fa3] transition-colors cursor-pointer"
              title="Copy message"
              tabIndex={status === 'sent' ? 0 : -1}
            >
              {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
            </button>
            {voiceAvailable && (
              <button
                type="button"
                onClick={handleTts}
                className={clsx(
                  'p-2 inline-flex items-center justify-center transition-colors cursor-pointer',
                  ttsState === 'playing' ? 'text-primary' : 'text-[#8b8fa3]/60 hover:text-[#8b8fa3]',
                  ttsState === 'loading' && 'animate-spin'
                )}
                title={ttsState === 'playing' ? 'Stop playback' : 'Read aloud'}
                tabIndex={status === 'sent' ? 0 : -1}
              >
                {ttsState === 'loading' ? <IconLoader size={14} /> : ttsState === 'playing' ? <IconPlayerStop size={14} /> : <IconVolume size={14} />}
              </button>
            )}
          </span>
          {canShare && (
            <span className={clsx('ml-auto inline-flex items-center opacity-0 transition-opacity', status === 'sent' && 'group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100')}>
              <button
                type="button"
                onClick={handleShare}
                className="p-2 inline-flex items-center justify-center text-[#8b8fa3]/60 hover:text-[#8b8fa3] transition-colors cursor-pointer"
                title="Share message"
                tabIndex={status === 'sent' ? 0 : -1}
              >
                <IconShare size={14} />
              </button>
            </span>
          )}
          {status === 'failed' && onRetry && (
            <span className="inline text-[11px] text-primary cursor-pointer ml-1.5 underline" onClick={onRetry}>retry</span>
          )}
        </div>
        <div className="msg-content" ref={contentRef} dangerouslySetInnerHTML={{ __html: html }} />
        {attachmentCount && attachmentCount > 0 ? (
          <div className="text-xs opacity-60 mt-1">
            {'\u{1F4CE}'} {attachmentCount} attachment{attachmentCount > 1 ? 's' : ''}
          </div>
        ) : null}
      </div>
    </div>
  )
}
