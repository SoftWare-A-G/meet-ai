import clsx from 'clsx'
import { ChevronUp } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useChatContext } from '../../lib/chat-context'
import { formatRelativeTime } from '../../lib/dates'
import type { AgentActivity, AgentState } from '../../lib/activity'

const TIMESTAMP_INTERVAL = 15_000

function StateDot({ state }: { state: AgentState }) {
  return (
    <span
      className={clsx(
        'inline-block w-1.5 h-1.5 rounded-full shrink-0',
        state === 'working' && 'bg-green-500 animate-pulse',
        state === 'idle' && 'bg-neutral-500'
      )}
    />
  )
}

function buildAriaAnnouncement(entries: AgentActivity[]): string {
  const working = entries.filter(a => a.state === 'working')
  if (working.length === 0) return 'All agents idle'
  return working.map(a => `${a.agentName} working: ${a.latestAction}`).join('. ')
}

type ActivityBarProps = {
  onClick?: () => void
}

export default function ActivityBar({ onClick }: ActivityBarProps) {
  const { teamInfo, agentActivity } = useChatContext()
  const [, setTick] = useState(0)
  const prevAnnouncementRef = useRef('')

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), TIMESTAMP_INTERVAL)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') setTick(t => t + 1)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  if (!teamInfo) return null

  const entries = Array.from(agentActivity.values())
  const nonIdle = entries.filter(a => a.state !== 'idle')
  const allIdle = nonIdle.length === 0
  const workingCount = nonIdle.length

  // Find most recent activity across all agents
  const mostRecent = entries.reduce<AgentActivity | null>((best, a) => {
    if (!a.lastActivityAt) return best
    if (!best || !best.lastActivityAt) return a
    return a.lastActivityAt > best.lastActivityAt ? a : best
  }, null)

  const announcement = buildAriaAnnouncement(entries)
  if (announcement !== prevAnnouncementRef.current) {
    prevAnnouncementRef.current = announcement
  }

  const timeStr = mostRecent?.lastActivityAt ? formatRelativeTime(mostRecent.lastActivityAt) : ''

  return (
    <div
      className={clsx(
        'w-full border-t border-neutral-800 bg-neutral-900/50 px-3 py-1.5 text-xs text-neutral-300 shrink-0 overflow-hidden',
        onClick && 'cursor-pointer hover:bg-neutral-800/50 transition-colors'
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? e => {
              if (e.key === 'Enter' || e.key === ' ') onClick()
            }
          : undefined
      }>
      <span aria-live="polite" className="sr-only">
        {prevAnnouncementRef.current}
      </span>
      <div className="flex min-w-0 items-center gap-2">
        <div className="min-w-0 flex-1">
          {allIdle ? (
            <div className="flex min-w-0 items-center gap-1.5 opacity-50">
              <StateDot state="idle" />
              <span className="shrink-0">All agents idle</span>
              {timeStr && (
                <>
                  <span className="shrink-0 opacity-40">&middot;</span>
                  <span className="shrink-0 whitespace-nowrap opacity-40">
                    last activity {timeStr}
                  </span>
                </>
              )}
            </div>
          ) : (
            <div className="flex min-w-0 items-center gap-1.5">
              {/* Fixed left: status + label */}
              <StateDot state="working" />
              <span className="shrink-0 whitespace-nowrap">
                {workingCount} agent{workingCount !== 1 ? 's' : ''} working
              </span>
              {/* Flexible middle: action text — sole truncation target */}
              {mostRecent?.latestAction && (
                <>
                  <span className="shrink-0 opacity-40">&middot;</span>
                  <span className="min-w-0 flex-1 truncate opacity-70">
                    {mostRecent.latestAction}
                  </span>
                </>
              )}
              {/* Fixed right: timestamp */}
              {timeStr && (
                <>
                  <span className="shrink-0 opacity-40">&middot;</span>
                  <span className="shrink-0 whitespace-nowrap opacity-40">{timeStr}</span>
                </>
              )}
            </div>
          )}
        </div>
        {onClick && <ChevronUp className="h-3.5 w-3.5 shrink-0 opacity-40" />}
      </div>
    </div>
  )
}
