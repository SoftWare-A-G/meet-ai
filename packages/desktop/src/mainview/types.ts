import * as Phaser from 'phaser'

export interface TeamMember {
  teammate_id: string
  name: string
  color: string
  role: string
  model?: string
  status: 'active' | 'inactive'
  joinedAt?: string
}

export interface StoredTask {
  id: string
  subject: string
  description?: string
  status: string
  assignee?: string
}

// Pure data fields — no rendering types
export interface AgentData {
  id: string
  name: string
  color: string
  role: string
  status: 'idle' | 'working' | 'talking' | 'error'
  xp: number
  level: number
  focus: number // 0-100: how sharp the agent is (decreases with work, recovers when idle)
  fatigue: number // 0-100: exhaustion level (increases with work, decreases when idle)
  mood: number // 0-100: happiness (increases on task completion, decreases on errors/long work)
  tasksCompleted: number
  messagesCount: number
  toolUses: number
  boosted: boolean // player applied boost
  boostEndTime: number
  bobPhase: number
  bobSpeed: number
  lastActivity: number
  spawnIndex: number
  nextWanderTime: number
  lastToolXpTime: number
}

// Phaser render handles
export interface AgentRenderState {
  position: { x: number; y: number }
  targetPosition: { x: number; y: number }
  worldX: number
  worldZ: number
  targetWorldX: number
  targetWorldZ: number
  group: Phaser.GameObjects.Container
  bodyMesh: Phaser.GameObjects.Graphics
  glowMesh: Phaser.GameObjects.Graphics
  nameLabel: Phaser.GameObjects.Text
  bubble: Phaser.GameObjects.DOMElement | null
  bubbleTimeout: ReturnType<typeof setTimeout> | null
  activityRing: Phaser.GameObjects.Graphics
  headMesh: Phaser.GameObjects.Graphics
}

// Combined type for backward compatibility during migration
export type AgentState = AgentData & AgentRenderState

export interface SpawnBeam {
  graphic: Phaser.GameObjects.Graphics
  startTime: number
  duration: number
}

export interface ParticleEffect {
  emitter: Phaser.GameObjects.Particles.ParticleEmitter
  velocities: Float32Array
  startTime: number
  duration: number
}

export interface FloatingText {
  text: Phaser.GameObjects.Text
  startTime: number
  duration: number
  startY: number
}

export interface ZoneParticleSystem {
  emitter: Phaser.GameObjects.Particles.ParticleEmitter
  behavior: string
  zoneX: number
  zoneZ: number
}

export interface Contract {
  id: string
  title: string
  assignee?: string
  status: 'posted' | 'claimed' | 'active' | 'completed' | 'failed'
  difficulty: 'easy' | 'normal' | 'hard'
  reward: number
  scrollObject?: Phaser.GameObjects.Text
}

export interface EventLogEntry {
  time: number
  agent: string
  text: string
  type: 'tool' | 'message' | 'task' | 'error'
}

export interface FrameContext {
  elapsed: number
  delta: number
  now: number
}

export interface SceneContext {
  game: Phaser.Game
  scene: Phaser.Scene
}
