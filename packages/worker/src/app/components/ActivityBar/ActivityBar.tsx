import { useState, useEffect, useRef } from 'react'
import clsx from 'clsx'
import { useChatContext } from '../../lib/chat-context'
import { ensureSenderContrast } from '../../lib/colors'
import { formatRelativeTime } from '../../lib/dates'
import type { AgentActivity, AgentState } from '../../lib/activity'

const MAX_VISIBLE = 4
const TIMESTAMP_INTERVAL = 15_000

function StateDot({ state }: { state: AgentState }) {
  return (
    <span
      className={clsx(
        'inline-block w-1.5 h-1.5 rounded-full shrink-0',
        state === 'working' && 'bg-green-500 animate-pulse',
        state === 'idle' && 'bg-neutral-500',
      )}
    />
  )
}

function stateLabel(state: AgentState): string {
  return state === 'idle' ? 'idle' : 'working'
}

function AgentRow({ activity }: { activity: AgentActivity }) {
  const nameColor = ensureSenderContrast(activity.color)
  const timeStr = activity.lastActivityAt ? formatRelativeTime(activity.lastActivityAt) : ''

  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <StateDot state={activity.state} />
      <span className="font-medium whitespace-nowrap" style={{ color: nameColor }}>
        {activity.agentName}:
      </span>
      <span className="truncate opacity-70">
        {activity.latestAction || stateLabel(activity.state)}
      </span>
      {timeStr && (
        <>
          <span className="opacity-40 shrink-0">&middot;</span>
          <span className="opacity-40 whitespace-nowrap shrink-0">{timeStr}</span>
        </>
      )}
    </div>
  )
}

/**
 * Build a summary string for screen readers that only changes on meaningful
 * state transitions (agent starts working, goes idle, new agent appears).
 * Timestamp refreshes do NOT alter this string.
 */
function buildAriaAnnouncement(entries: AgentActivity[]): string {
  const working = entries.filter(a => a.state === 'working')
  if (working.length === 0) return 'All agents idle'
  return working.map(a => `${a.agentName} working: ${a.latestAction}`).join('. ')
}

export default function ActivityBar() {
  const { teamInfo, agentActivity } = useChatContext()
  // Tick counter forces re-render every 15s so relative timestamps stay fresh
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

  // Find most recent activity timestamp across all agents
  const latestTimestamp = entries.reduce<string | null>((latest, a) => {
    if (!a.lastActivityAt) return latest
    if (!latest) return a.lastActivityAt
    return a.lastActivityAt > latest ? a.lastActivityAt : latest
  }, null)

  if (allIdle && !latestTimestamp && entries.length === 0) return null

  // Sort non-idle by most recent first
  const sorted = nonIdle.sort((a, b) => {
    if (!a.lastActivityAt) return 1
    if (!b.lastActivityAt) return -1
    return b.lastActivityAt.localeCompare(a.lastActivityAt)
  })
  const visible = sorted.slice(0, MAX_VISIBLE)
  const overflowCount = sorted.length - MAX_VISIBLE

  // Only update the aria announcement when the state actually changes
  // (not on timestamp ticks). This prevents screen reader churn.
  const announcement = buildAriaAnnouncement(entries)
  if (announcement !== prevAnnouncementRef.current) {
    prevAnnouncementRef.current = announcement
  }

  return (
    <div
      className="border-t border-neutral-800 bg-neutral-900/50 px-3 py-1.5 text-xs text-neutral-300 shrink-0"
    >
      {/* Visually hidden live region — only updates on meaningful state changes */}
      <span aria-live="polite" className="sr-only">
        {prevAnnouncementRef.current}
      </span>
      {allIdle ? (
        <div className="flex items-center gap-1.5 opacity-50">
          <StateDot state="idle" />
          <span>All agents idle</span>
          {latestTimestamp && (
            <>
              <span>&middot;</span>
              <span>last activity {formatRelativeTime(latestTimestamp)}</span>
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-0.5">
          {visible.map(a => (
            <AgentRow key={a.agentName} activity={a} />
          ))}
          {overflowCount > 0 && (
            <div className="opacity-40">+{overflowCount} more</div>
          )}
        </div>
      )}
    </div>
  )
}
