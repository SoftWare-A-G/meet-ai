export type CodingAgentId = 'claude' | 'codex'

export const CODING_AGENT_OPTIONS = [
  { id: 'claude', label: 'Claude Code' },
  { id: 'codex', label: 'Codex' },
] as const
