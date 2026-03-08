export type CodingAgentId = 'claude' | 'codex'

export interface CodingAgentDefinition {
  id: CodingAgentId
  label: string
}

export const CODING_AGENT_DEFINITIONS: readonly CodingAgentDefinition[] = [
  { id: 'claude', label: 'Claude Code' },
  { id: 'codex', label: 'Codex' },
] as const

export function isCodingAgentId(value: string): value is CodingAgentId {
  return CODING_AGENT_DEFINITIONS.some(agent => agent.id === value)
}

export function getCodingAgentDefinition(agentId: CodingAgentId): CodingAgentDefinition {
  const agent = CODING_AGENT_DEFINITIONS.find(entry => entry.id === agentId)
  if (!agent) {
    throw new Error(`Unsupported coding agent: ${agentId}`)
  }
  return agent
}
