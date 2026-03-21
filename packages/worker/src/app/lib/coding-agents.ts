export type CodingAgentId = 'claude' | 'codex' | 'pi' | 'opencode'

export const CODING_AGENT_OPTIONS = [
  { id: 'claude', label: 'Claude Code' },
  { id: 'codex', label: 'Codex' },
  { id: 'pi', label: 'Pi' },
  { id: 'opencode', label: 'OpenCode' },
] as const
