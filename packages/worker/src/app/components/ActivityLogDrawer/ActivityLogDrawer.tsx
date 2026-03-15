import { useState, useEffect, useMemo } from 'react'
import clsx from 'clsx'
import { DrawerRoot, DrawerPopup, DrawerHandle, DrawerTitle } from '../ui/drawer'
import DiffBlock from '../DiffBlock'
import { parseAgentActivity } from '../../lib/activity'
import { formatRelativeTime } from '../../lib/dates'
import { ensureSenderContrast, hashColor } from '../../lib/colors'
import type { Message, TeamInfo } from '../../lib/types'

type DisplayMessage = Message & {
  tempId?: string
  status?: 'sent' | 'pending' | 'failed'
}

type ActivityLogDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  messages: DisplayMessage[]
  teamInfo: TeamInfo | null
}


type FilterState = {
  agent: string | null
}

const TIMESTAMP_INTERVAL = 15_000

export default function ActivityLogDrawer({ open, onOpenChange, messages, teamInfo }: ActivityLogDrawerProps) {
  const [filter, setFilter] = useState<FilterState>({ agent: null })
  const [, setTick] = useState(0)

  // 15s timestamp refresh
  useEffect(() => {
    if (!open) return
    const interval = setInterval(() => setTick(t => t + 1), TIMESTAMP_INTERVAL)
    return () => clearInterval(interval)
  }, [open])

  // Get all log messages (excluding hook sender)
  const logMessages = useMemo(() =>
    messages.filter(m => m.type === 'log' && m.sender !== 'hook'),
    [messages]
  )

  // Derive unique agents from log messages
  const agents = useMemo(() => {
    const agentMap = new Map<string, { name: string; color: string }>()
    for (const msg of logMessages) {
      const parsed = parseAgentActivity(msg)
      if (parsed && !agentMap.has(parsed.agentName)) {
        const member = teamInfo?.members.find(m => m.name === parsed.agentName)
        agentMap.set(parsed.agentName, {
          name: parsed.agentName,
          color: member?.color || msg.color || '',
        })
      }
    }
    return Array.from(agentMap.values())
  }, [logMessages, teamInfo])

  // Filter logs by selected agent
  const filteredLogs = useMemo(() => {
    const logs = filter.agent
      ? logMessages.filter(m => m.sender === filter.agent)
      : logMessages
    // Reverse chronological (newest first)
    return [...logs].reverse()
  }, [logMessages, filter.agent])

  return (
    <DrawerRoot
      open={open}
      onOpenChange={(nextOpen) => onOpenChange(nextOpen)}
      modal={false}
      snapPoints={[0.3, 0.7]}
    >
      <DrawerPopup className="z-40" showBackdrop={false}>
        {/* Swipe handle */}
        <DrawerHandle>
          <div className="h-1 w-8 rounded-full bg-neutral-600" />
        </DrawerHandle>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-2">
          <DrawerTitle className="text-sm font-semibold text-neutral-300">
            Activity
          </DrawerTitle>
        </div>

        {/* Agent filter pills */}
        {agents.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto px-4 pb-2 scrollbar-none" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={filter.agent === null}
              onClick={() => setFilter({ agent: null })}
              className={clsx(
                'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
                filter.agent === null
                  ? 'bg-neutral-600 text-white'
                  : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
              )}
            >
              All
            </button>
            {agents.map(agent => {
              const isActive = filter.agent === agent.name
              const color = agent.color ? ensureSenderContrast(agent.color) : hashColor(agent.name)
              return (
                <button
                  type="button"
                  key={agent.name}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setFilter({ agent: isActive ? null : agent.name })}
                  className={clsx(
                    'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
                    isActive
                      ? 'bg-neutral-600 text-white'
                      : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                  )}
                  style={isActive ? { backgroundColor: color, color: '#fff' } : undefined}
                >
                  {agent.name}
                </button>
              )
            })}
          </div>
        )}

        {/* Log entries — swipe-ignore so scrolling doesn't dismiss drawer */}
        <div className="flex-1 overflow-y-auto px-4 pb-4" role="log" data-base-ui-swipe-ignore>
          {filteredLogs.length === 0 ? (
            <div className="py-8 text-center text-xs text-neutral-500">
              No activity logs yet
            </div>
          ) : (
            <div className="flex flex-col gap-px">
              {filteredLogs.map((msg, i) => (
                <LogEntry
                  key={`${msg.sender}-${msg.created_at}-${i}`}
                  msg={msg}
                  teamInfo={teamInfo}
                />
              ))}
            </div>
          )}
        </div>
      </DrawerPopup>
    </DrawerRoot>
  )
}

function LogEntry({ msg, teamInfo }: { msg: DisplayMessage; teamInfo: TeamInfo | null }) {
  const member = teamInfo?.members.find(m => m.name === msg.sender)
  const color = member?.color || msg.color || ''
  const nameColor = color ? ensureSenderContrast(color) : hashColor(msg.sender)
  const timeStr = formatRelativeTime(msg.created_at)

  // Check for diff content
  const diffMatch = msg.content.match(/^\[diff:(.+?)\]\n([\s\S]*)$/)
  if (diffMatch) {
    return (
      <DiffBlock
        filename={diffMatch[1]}
        hunks={[diffMatch[2]]}
        timestamp={msg.created_at}
      />
    )
  }

  return (
    <div className="flex items-baseline gap-1.5 py-0.5 font-mono text-xs">
      <span className="shrink-0 whitespace-nowrap text-neutral-500">
        {timeStr}
      </span>
      <span className="shrink-0 whitespace-nowrap font-semibold" style={{ color: nameColor }}>
        {msg.sender}:
      </span>
      <span className="min-w-0 break-words text-neutral-300">
        {msg.content}
      </span>
    </div>
  )
}
