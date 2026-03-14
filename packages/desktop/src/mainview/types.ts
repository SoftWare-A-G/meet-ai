import type * as THREE from 'three'
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js'

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

// Pure data fields — no Three.js types
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

// Three.js render handles
export interface AgentRenderState {
  position: THREE.Vector3
  targetPosition: THREE.Vector3
  group: THREE.Group
  bodyMesh: THREE.Mesh
  glowMesh: THREE.Mesh
  nameLabel: CSS2DObject
  bubble: CSS2DObject | null
  bubbleTimeout: ReturnType<typeof setTimeout> | null
  activityRing: THREE.Mesh
  headMesh?: THREE.Mesh
}

// Combined type for backward compatibility during migration
export type AgentState = AgentData & AgentRenderState

export interface SpawnBeam {
  mesh: THREE.Mesh
  startTime: number
  duration: number
}

export interface ParticleEffect {
  points: THREE.Points
  velocities: Float32Array
  startTime: number
  duration: number
}

export interface FloatingText {
  label: CSS2DObject
  startTime: number
  duration: number
  startY: number
}

export interface ZoneParticleSystem {
  points: THREE.Points
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
  scrollObject?: CSS2DObject
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
  renderer: THREE.WebGLRenderer
  cssRenderer: CSS2DRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  controls: OrbitControls
  canvas: HTMLCanvasElement
}
