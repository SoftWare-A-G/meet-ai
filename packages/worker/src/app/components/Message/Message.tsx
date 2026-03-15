import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import clsx from 'clsx'
import { getRouteApi } from '@tanstack/react-router'
import { hashColor, ensureSenderContrast } from '../../lib/colors'
import { formatTime } from '../../lib/dates'
import { useTextToSpeech } from '../../hooks/useTtsQuery'
import { IconCopy, IconCheck, IconShare, IconVolume, IconPlayerStop, IconLoader } from '../../icons'
import MarkdownContent from '../MarkdownContent'
import SlashCommandBadge from '../SlashCommandBadge'
import { useCommandsCache } from '../../hooks/useCommandsCache'
import { useTeamInfoQuery } from '../../hooks/useTeamInfoQuery'
import { useChatContext } from '../../lib/chat-context'
import { useHaptics } from '../../hooks/useHaptics'
import type { CommandItem } from '../../lib/fetchers'

const chatRoute = getRouteApi('/chat/$id')

type TtsState = 'idle' | 'loading' | 'playing'

function parseSlashCommand(content: string, commands: CommandItem[] | null): { command: CommandItem; promptText: string } | null {
  if (!commands || !content.startsWith('/')) return null
  const trimmed = content.slice(1)
  // Match longest command name first (e.g., "ce:plan" before "ce")
  const sorted = [...commands].sort((a, b) => b.name.length - a.name.length)
  for (const cmd of sorted) {
    if (trimmed === cmd.name || trimmed.startsWith(`${cmd.name} `)) {
      const promptText = trimmed.slice(cmd.name.length).trim()
      return { command: cmd, promptText }
    }
  }
  return null
}

type MessageProps = {
  sender: string
  content: string
  color?: string | null
  timestamp?: string
  tempId?: string
  status?: 'sent' | 'pending' | 'failed'
  onRetry?: () => void
  attachmentCount?: number
  voiceAvailable?: boolean
}

export default function Message({ sender, content, color, timestamp, tempId, status = 'sent', onRetry, attachmentCount, voiceAvailable }: MessageProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const { id: roomId } = chatRoute.useParams()
  const { data: teamInfo } = useTeamInfoQuery(roomId)
  const { data: commandsInfo } = useCommandsCache(roomId)
  const { insertMention } = useChatContext()
  const { trigger } = useHaptics()
  const senderTeamColor = teamInfo?.members.find(member => member.name === sender)?.color
  const senderColor = senderTeamColor
    ? ensureSenderContrast(senderTeamColor)
    : color
      ? ensureSenderContrast(color)
      : hashColor(sender)
  const slashMatch = useMemo(() => parseSlashCommand(content, commandsInfo), [content, commandsInfo])
  const ttsMutation = useTextToSpeech()
  const [copied, setCopied] = useState(false)
  const [ttsState, setTtsState] = useState<TtsState>('idle')

  const timeText = status === 'failed' ? 'failed' : formatTime(timestamp)

  const handleCopy = useCallback(() => {
    trigger('light')
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [content, trigger])

  const handleShare = useCallback(() => {
    trigger('light')
    navigator.share({ text: content })
  }, [content, trigger])

  const handleTts = useCallback(async () => {
    if (ttsState === 'loading') return
    trigger('light')

    if (ttsState === 'playing') {
      audioRef.current?.pause()
      audioRef.current = null
      setTtsState('idle')
      return
    }

    setTtsState('loading')
    try {
      const audioData = await ttsMutation.mutateAsync(content)
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
  }, [content, ttsState, trigger, ttsMutation])

  // Cleanup audio on unmount
  useEffect(() => () => {
    audioRef.current?.pause()
    audioRef.current = null
  }, [])

  const canShare = typeof navigator !== 'undefined' && 'share' in navigator

  return (
    <div className={clsx(
      'group relative rounded-md px-2 py-1.5 text-sm break-words hover:bg-white/[0.08]',
      status === 'pending' && 'opacity-50',
      status === 'failed' && 'border-l-2 border-red-500/50 bg-red-500/[0.04]',
      slashMatch && slashMatch.command.type === 'skill' && 'border-l-2 border-[#a855f7] bg-[#a855f7]/[0.06]',
      slashMatch && slashMatch.command.type !== 'skill' && 'border-l-2 border-[#3b82f6] bg-[#3b82f6]/[0.06]',
    )} data-temp-id={tempId} data-content={tempId ? content : undefined}>
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <button
            type="button"
            className="-ml-1 inline-flex items-center rounded-full border border-transparent bg-transparent px-1 py-0.5 text-sm font-bold cursor-pointer transition-colors hover:bg-white/[0.08]"
            style={{ color: senderColor }}
            onClick={() => insertMention(sender)}
            title={`Mention @${sender}`}
          >
            {sender}
          </button>
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
        {slashMatch ? (
          <div className="msg-content">
            <SlashCommandBadge
              commandName={slashMatch.command.name}
              promptText={slashMatch.promptText}
              commandType={slashMatch.command.type}
            />
          </div>
        ) : (
          <MarkdownContent content={content} className="msg-content" />
        )}
        {attachmentCount && attachmentCount > 0 ? (
          <div className="text-xs opacity-60 mt-1">
            {'\u{1F4CE}'} {attachmentCount} attachment{attachmentCount > 1 ? 's' : ''}
          </div>
        ) : null}
      </div>
    </div>
  )
}
