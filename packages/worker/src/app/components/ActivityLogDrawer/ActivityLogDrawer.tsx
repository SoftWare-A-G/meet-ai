import { useState, useEffect, useMemo } from 'react'
import clsx from 'clsx'
import { getRouteApi } from '@tanstack/react-router'
import { DrawerRoot, DrawerPopup, DrawerContent, DrawerHandle, DrawerTitle } from '../ui/drawer'
import DiffBlock from '../DiffBlock'
import { useTeamInfoQuery } from '../../hooks/useTeamInfoQuery'
import { parseAgentActivity } from '../../lib/activity'
import { formatRelativeTime } from '../../lib/dates'
import { ensureSenderContrast, hashColor, resolveColor } from '../../lib/colors'
import { contrastRatio } from '../../lib/theme'
import type { Message } from '../../lib/types'

const chatRoute = getRouteApi('/chat/$id')

/** Ensure a color works as a pill background on the dark drawer surface (#171717). */
function pillBgColor(rawColor: string): string {
  const DRAWER_BG = '#171717'
  const MIN_RATIO = 2.5
  const resolved = resolveColor(rawColor)
  if (contrastRatio(resolved, DRAWER_BG) >= MIN_RATIO) return rawColor
  // Brighten until it clears the minimum contrast
  const [r, g, b] = resolved.replace('#', '').match(/.{2}/g)!.map(h => parseInt(h, 16))
  for (let f = 1.3; f <= 3; f += 0.2) {
    const boosted = `#${[r, g, b].map(v => Math.min(255, Math.round(v * f)).toString(16).padStart(2, '0')).join('')}`
    if (contrastRatio(boosted, DRAWER_BG) >= MIN_RATIO) return boosted
  }
  return rawColor
}

type DisplayMessage = Message & {
  tempId?: string
  status?: 'sent' | 'pending' | 'failed'
}

type ActivityLogDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  messages: DisplayMessage[]
}


type FilterState = {
  agent: string | null
}

const TIMESTAMP_INTERVAL = 15_000
const PAGE_SIZE = 100

export default function ActivityLogDrawer({ open, onOpenChange, messages }: ActivityLogDrawerProps) {
  const { id: roomId } = chatRoute.useParams()
  const { data: teamInfo } = useTeamInfoQuery(roomId)
  const [filter, setFilter] = useState<FilterState>({ agent: null })
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
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

  // Derive unique agents from log messages + team info, inactive agents sorted last
  const agents = useMemo(() => {
    const agentMap = new Map<string, { name: string; color: string; active: boolean }>()

    // Agents that have log messages
    for (const msg of logMessages) {
      const parsed = parseAgentActivity(msg)
      if (parsed && !agentMap.has(parsed.agentName)) {
        const member = teamInfo?.members.find(m => m.name === parsed.agentName)
        agentMap.set(parsed.agentName, {
          name: parsed.agentName,
          color: member?.color || msg.color || '',
          active: member?.status !== 'inactive',
        })
      }
    }

    // Include team members that have no log messages yet (e.g. just joined)
    if (teamInfo) {
      for (const member of teamInfo.members) {
        if (!agentMap.has(member.name)) {
          agentMap.set(member.name, {
            name: member.name,
            color: member.color || '',
            active: member.status !== 'inactive',
          })
        }
      }
    }

    // Active agents first, inactive at the end
    return Array.from(agentMap.values()).sort((a, b) => {
      if (a.active === b.active) return 0
      return a.active ? -1 : 1
    })
  }, [logMessages, teamInfo])

  // Reset visible count when filter changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [filter.agent])

  // Filter logs by selected agent
  const filteredLogs = useMemo(() => {
    const logs = filter.agent
      ? logMessages.filter(m => m.sender === filter.agent)
      : logMessages
    // Reverse chronological (newest first)
    return [...logs].reverse()
  }, [logMessages, filter.agent])

  const visibleLogs = filteredLogs.slice(0, visibleCount)
  const hasMore = filteredLogs.length > visibleCount

  return (
    <DrawerRoot
      open={open}
      onOpenChange={(nextOpen) => onOpenChange(nextOpen)}
      modal={false}
      snapPoints={[0.5]}
    >
      <DrawerPopup className="h-[50dvh]" showBackdrop={false} showCloseButton={false}>
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
          <div className="flex shrink-0 basis-auto items-center gap-1.5 overflow-x-auto px-4 py-2.5 scrollbar-none" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={filter.agent === null}
              onClick={() => setFilter({ agent: null })}
              className={clsx(
                'inline-flex h-8 items-center justify-center whitespace-nowrap rounded-full px-3 text-xs font-medium transition-colors',
                filter.agent === null
                  ? 'bg-neutral-300 text-neutral-900'
                  : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
              )}
            >
              All
            </button>
            {agents.map(agent => {
              const isSelected = filter.agent === agent.name
              const rawColor = agent.color || hashColor(agent.name)
              const bg = pillBgColor(rawColor)
              const resolvedBg = resolveColor(bg)
              const textColor = contrastRatio('#fff', resolvedBg) >= contrastRatio('#000', resolvedBg) ? '#fff' : '#000'
              const unselectedTextColor = ensureSenderContrast(rawColor)
              return (
                <button
                  type="button"
                  key={agent.name}
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setFilter({ agent: isSelected ? null : agent.name })}
                  className={clsx(
                    'inline-flex h-8 items-center justify-center whitespace-nowrap rounded-full px-3 text-xs font-medium transition-colors',
                    isSelected
                      ? 'ring-1 ring-inset ring-white/30'
                      : !agent.active
                        ? 'bg-neutral-900 opacity-40 hover:opacity-60'
                        : 'bg-neutral-800 hover:bg-neutral-700'
                  )}
                  style={isSelected
                    ? { backgroundColor: bg, color: textColor }
                    : { color: agent.active ? unselectedTextColor : undefined }
                  }
                >
                  {agent.name}
                </button>
              )
            })}
          </div>
        )}

        {/* Log entries — DrawerContent prevents pointer-swipe dismissal while scrolling */}
        <DrawerContent className="min-h-0 overflow-y-auto px-4 pb-4" role="log">
          {filteredLogs.length === 0 ? (
            <div className="py-8 text-center text-xs text-neutral-500">
              No activity logs yet
            </div>
          ) : (
            <div className="flex flex-col gap-px">
              {visibleLogs.map((msg, i) => (
                <LogEntry
                  key={`${msg.sender}-${msg.created_at}-${i}`}
                  msg={msg}
                  teamInfo={teamInfo}
                />
              ))}
              {hasMore && (
                <button
                  type="button"
                  onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                  className="mt-2 self-center rounded-full bg-neutral-800 px-3 py-1 text-xs text-neutral-400 transition-colors hover:bg-neutral-700 hover:text-neutral-300"
                >
                  Show more ({filteredLogs.length - visibleCount} remaining)
                </button>
              )}
            </div>
          )}
        </DrawerContent>
      </DrawerPopup>
    </DrawerRoot>
  )
}

function LogEntry({ msg, teamInfo }: { msg: DisplayMessage; teamInfo: ReturnType<typeof useTeamInfoQuery>['data'] }) {
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
      <span className="w-[4.5rem] shrink-0 text-right tabular-nums whitespace-nowrap text-neutral-500">
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
