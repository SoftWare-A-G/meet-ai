import { useState, useEffect, useRef, useCallback } from 'react'
import { parseAgentActivity } from '../lib/activity'
import type { AgentActivity } from '../lib/activity'
import type { Message, TeamInfo } from '../lib/types'

const IDLE_TIMEOUT = 20_000 // 20 seconds
const THROTTLE_MS = 500 // max 2Hz updates

export function useAgentActivity(
  messages: Message[],
  teamInfo: TeamInfo | null,
): Map<string, AgentActivity> {
  const [activity, setActivity] = useState<Map<string, AgentActivity>>(() => new Map())
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const latestRef = useRef<Map<string, { action: string; timestamp: string }>>(new Map())
  const throttleRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingUpdateRef = useRef(false)

  const computeActivity = useCallback(() => {
    if (!teamInfo) {
      setActivity(new Map())
      return
    }

    const now = Date.now()
    const next = new Map<string, AgentActivity>()

    for (const member of teamInfo.members) {
      if (member.status !== 'active') continue

      const latest = latestRef.current.get(member.name)
      let state: AgentActivity['state'] = 'idle'
      let latestAction = ''
      let lastActivityAt = ''

      if (latest) {
        const elapsed = now - new Date(latest.timestamp).getTime()
        latestAction = latest.action
        lastActivityAt = latest.timestamp
        state = elapsed < IDLE_TIMEOUT ? 'working' : 'idle'
      }

      next.set(member.name, {
        agentName: member.name,
        state,
        latestAction,
        lastActivityAt,
        color: member.color,
      })
    }

    setActivity(next)
  }, [teamInfo])

  // Keep a stable ref to the latest computeActivity so throttle timers
  // never call a stale closure (e.g. one that captured teamInfo = null).
  const computeRef = useRef(computeActivity)
  computeRef.current = computeActivity

  // Throttled compute — max 2Hz
  const scheduleUpdate = useCallback(() => {
    if (throttleRef.current) {
      pendingUpdateRef.current = true
      return
    }
    computeRef.current()
    throttleRef.current = setTimeout(() => {
      throttleRef.current = null
      if (pendingUpdateRef.current) {
        pendingUpdateRef.current = false
        computeRef.current()
      }
    }, THROTTLE_MS)
  }, [])

  // Process messages to extract latest per-agent log
  useEffect(() => {
    let changed = false
    for (const msg of messages) {
      const parsed = parseAgentActivity(msg)
      if (!parsed) continue
      const existing = latestRef.current.get(parsed.agentName)
      if (!existing || msg.created_at > existing.timestamp) {
        latestRef.current.set(parsed.agentName, {
          action: parsed.action,
          timestamp: msg.created_at,
        })
        changed = true

        // Reset idle timer for this agent
        const prevTimer = timersRef.current.get(parsed.agentName)
        if (prevTimer) clearTimeout(prevTimer)
        const agentName = parsed.agentName
        timersRef.current.set(
          agentName,
          setTimeout(() => {
            scheduleUpdate()
          }, IDLE_TIMEOUT),
        )
      }
    }
    if (changed) {
      scheduleUpdate()
    }
  }, [messages, scheduleUpdate])

  // Recompute immediately when teamInfo changes — don't throttle this
  // since it's a rare event and we need the activity bar to appear promptly.
  useEffect(() => {
    computeRef.current()
  }, [teamInfo])

  // Cleanup timers on unmount
  useEffect(() => {
    const timers = timersRef.current
    return () => {
      for (const timer of timers.values()) clearTimeout(timer)
      timers.clear()
      if (throttleRef.current) clearTimeout(throttleRef.current)
    }
  }, [])

  return activity
}
