import type { Message } from './types'

export type AgentState = 'working' | 'idle'

export type AgentActivity = {
  agentName: string
  state: AgentState
  latestAction: string
  lastActivityAt: string
  color: string
}

/**
 * Extract agent name and action from a log message.
 * Only returns results for logs with a resolved agent name — filters out
 * unattributed `sender: 'hook'` entries so the activity UI never shows
 * a misleading "hook" pseudo-agent.
 */
export function parseAgentActivity(log: Message): { agentName: string; action: string } | null {
  if (log.type !== 'log') return null
  const sender = log.sender
  if (!sender || sender === 'hook') return null
  const action = log.content?.trim()
  if (!action) return null
  return { agentName: sender, action }
}
