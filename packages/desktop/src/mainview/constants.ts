export type AgentClass = {
  title: string
  bodyScale: { x: number; y: number; z: number }
  headSize: number
  emissiveIntensity: number
  metalness: number
  roughness: number
}

export const ZONES = {
  center: { x: 0, z: 0, color: '#555566', label: 'Spawn' },
  library: { x: 0, z: -8, color: '#3b82f6', label: 'Library' },
  workshop: { x: 8, z: 0, color: '#f59e0b', label: 'Workshop' },
  terminal: { x: 0, z: 8, color: '#22c55e', label: 'Terminal' },
  questBoard: { x: -8, z: 0, color: '#a855f7', label: 'Quest Board' },
} as const

// ─── Agent Classes ───
// Derive a character class from agent name/role for visual differentiation

export const AGENT_CLASSES: Record<string, AgentClass> = {
  commander: {
    title: '⚔️ Commander',
    bodyScale: { x: 1.15, y: 1.1, z: 1.15 },
    headSize: 0.22,
    emissiveIntensity: 0.25,
    metalness: 0.5,
    roughness: 0.3,
  },
  scholar: {
    title: '📚 Scholar',
    bodyScale: { x: 0.9, y: 1, z: 0.9 },
    headSize: 0.25,
    emissiveIntensity: 0.2,
    metalness: 0.1,
    roughness: 0.6,
  },
  artificer: {
    title: '⚒️ Artificer',
    bodyScale: { x: 1.1, y: 0.95, z: 1.1 },
    headSize: 0.2,
    emissiveIntensity: 0.3,
    metalness: 0.4,
    roughness: 0.3,
  },
  sentinel: {
    title: '🛡️ Sentinel',
    bodyScale: { x: 1.2, y: 1.05, z: 1.2 },
    headSize: 0.2,
    emissiveIntensity: 0.15,
    metalness: 0.6,
    roughness: 0.2,
  },
  oracle: {
    title: '🔮 Oracle',
    bodyScale: { x: 0.85, y: 1.15, z: 0.85 },
    headSize: 0.24,
    emissiveIntensity: 0.35,
    metalness: 0.2,
    roughness: 0.5,
  },
  default: {
    title: '👤 Agent',
    bodyScale: { x: 1, y: 1, z: 1 },
    headSize: 0.2,
    emissiveIntensity: 0.15,
    metalness: 0.2,
    roughness: 0.4,
  },
}

export function classifyAgent(name: string, role: string): AgentClass {
  const n = name.toLowerCase()
  const r = role.toLowerCase()

  // Commander: team-lead, lead, planner, orchestrator
  if (n.includes('lead') || n.includes('planner') || r.includes('lead') || r.includes('orchestrat'))
    {return AGENT_CLASSES.commander}

  // Scholar: researcher, research, reader
  if (n.includes('research') || r.includes('research') || n.includes('reader'))
    {return AGENT_CLASSES.scholar}

  // Artificer: codex, coder, builder, fix, migration
  if (
    n.includes('codex') ||
    n.includes('coder') ||
    n.includes('fix') ||
    n.includes('builder') ||
    n.includes('migration')
  )
    {return AGENT_CLASSES.artificer}

  // Sentinel: reviewer, verify, audit, guard
  if (n.includes('review') || n.includes('verify') || n.includes('audit') || n.includes('sentinel'))
    {return AGENT_CLASSES.sentinel}

  // Oracle: pi, oracle, advisor
  if (n === 'pi' || n.includes('oracle') || r.includes('oracle')) return AGENT_CLASSES.oracle

  return AGENT_CLASSES.default
}

export const LERP_SPEED = 3
export const BOB_AMPLITUDE = 0.06
export const BOB_FREQUENCY = 2
export const GLOW_PULSE_SPEED = 3.5
export const BUBBLE_DURATION = 5000
export const IDLE_TIMEOUT = 30000
export const WANDER_INTERVAL_MIN = 5000
export const WANDER_INTERVAL_MAX = 10000
export const WANDER_RADIUS = 1.5
export const IDLE_SPIN_SPEED = 0.3
export const SPAWN_RADIUS = 2
export const ZONE_SCATTER_RADIUS = 1.5

export const FATIGUE_TOOL_COST = 2
export const FATIGUE_RECOVERY_RATE = 1.5
export const FOCUS_GAIN_PER_USE = 10
export const FOCUS_MAX = 100
export const MAX_EVENT_LOG = 15
export const SPECIALTY_MAP: Record<string, { name: string; icon: string }> = {
  library: { name: 'Lorekeeper', icon: '\u{1F4D6}' },
  workshop: { name: 'Craftsman', icon: '\u{1F527}' },
  terminal: { name: 'Operator', icon: '\u{1F4BB}' },
  questBoard: { name: 'Quartermaster', icon: '\u{1F4DC}' },
}
export const GUILD_THRESHOLDS = [
  { level: 12, name: 'Legendary Guild' },
  { level: 8, name: 'Master Guild' },
  { level: 5, name: 'Journeyman Guild' },
  { level: 3, name: 'Apprentice Guild' },
  { level: 1, name: 'Unknown Guild' },
]
export const DIFFICULTY_REWARDS: Record<string, number> = { easy: 10, normal: 20, hard: 40 }
