import * as THREE from 'three'
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import {
  BOB_AMPLITUDE,
  GLOW_PULSE_SPEED,
  IDLE_SPIN_SPEED,
  ZONES,
  BUBBLE_DURATION,
} from '../constants'
import { computeSpawnPosition, lerpPosition, checkIdleWander } from '../domain/models/AgentModel'
import { createAgentMesh } from '../rendering/AgentRenderer'
import { EffectsManager } from '../rendering/EffectsManager'
import { createScene } from '../rendering/SceneSetup'
import { buildZoneMarkers, buildZoneStructures, initZoneParticles } from '../rendering/ZoneBuilder'
import type { ContractData } from '../domain/interfaces/IGameState'
import type { ISceneAdapter } from '../domain/interfaces/ISceneAdapter'
import type { AgentData, AgentRenderState, FrameContext, SceneContext, TeamMember } from '../types'

export class ThreeSceneAdapter implements ISceneAdapter {
  private readonly ctx: SceneContext
  private readonly agents = new Map<string, AgentRenderState>()
  private readonly contractScrolls = new Map<string, CSS2DObject>()
  private readonly effects: EffectsManager
  private readonly raycaster = new THREE.Raycaster()
  private readonly mouseVec = new THREE.Vector2()
  private elapsedTime = 0

  readonly canvas: HTMLCanvasElement

  constructor() {
    this.ctx = createScene()
    this.canvas = this.ctx.canvas
    this.effects = new EffectsManager(this.ctx.scene)

    // Build world
    buildZoneMarkers(this.ctx.scene)
    buildZoneStructures(this.ctx.scene)
    this.effects.setZoneParticleSystems(initZoneParticles(this.ctx.scene))
  }

  // ── Agent Lifecycle ──

  createAgent(member: TeamMember, spawnIndex: number, totalAgents: number): void {
    const renderState = createAgentMesh(member, spawnIndex, this.ctx.scene)
    const spawn = computeSpawnPosition(spawnIndex, totalAgents)
    renderState.position.set(spawn.x, 0, spawn.z)
    renderState.targetPosition.set(spawn.x, 0, spawn.z)
    renderState.group.position.set(spawn.x, 0, spawn.z)
    this.agents.set(member.teammate_id, renderState)
  }

  removeAgent(id: string): void {
    const rs = this.agents.get(id)
    if (!rs) return
    this.ctx.scene.remove(rs.group)
    this.agents.delete(id)
  }

  // ── Agent Visuals ──

  updateAgentColor(id: string, color: string): void {
    const rs = this.agents.get(id)
    if (!rs) return
    const newColor = new THREE.Color(color)
    const bodyMat = rs.bodyMesh.material as THREE.MeshStandardMaterial
    bodyMat.color.copy(newColor)
    bodyMat.emissive.copy(newColor)
  }

  updateAgentLabel(id: string, labelText: string): void {
    const rs = this.agents.get(id)
    if (!rs) return
    const el = rs.nameLabel.element as HTMLDivElement
    el.textContent = labelText
  }

  updateAgentLabelColor(id: string, color: string): void {
    const rs = this.agents.get(id)
    if (!rs) return
    ;(rs.nameLabel.element as HTMLDivElement).style.setProperty('--agent-color', color)
  }

  setAgentGlow(id: string, status: AgentData['status']): void {
    const rs = this.agents.get(id)
    if (!rs) return
    const mat = rs.glowMesh.material as THREE.MeshBasicMaterial
    switch (status) {
      case 'working': {
        mat.color.setHex(0x22cc55)
        break
      }
      case 'talking': {
        mat.color.setHex(0xeebb33)
        break
      }
      case 'error': {
        mat.color.setHex(0xee3333)
        break
      }
      default: {
        mat.color.setHex(0x3388ff)
      }
    }
  }

  setAgentEmissiveIntensity(id: string, intensity: number): void {
    const rs = this.agents.get(id)
    if (!rs) return
    const bodyMat = rs.bodyMesh.material as THREE.MeshStandardMaterial
    bodyMat.emissiveIntensity = intensity
  }

  setAgentFatigueDim(id: string, color: string, fatigueScale: number): void {
    const rs = this.agents.get(id)
    if (!rs) return
    const bodyMat = rs.bodyMesh.material as THREE.MeshStandardMaterial
    bodyMat.color.setStyle(color)
    bodyMat.color.multiplyScalar(fatigueScale)
  }

  // ── Agent Movement ──

  setAgentTargetPosition(id: string, x: number, z: number): void {
    const rs = this.agents.get(id)
    if (!rs) return
    rs.targetPosition.set(x, 0, z)
  }

  getAgentPosition(id: string): { x: number; z: number } | undefined {
    const rs = this.agents.get(id)
    if (!rs) return undefined
    return { x: rs.position.x, z: rs.position.z }
  }

  // ── Effects ──

  createParticleBurst(x: number, y: number, z: number, color: number, count: number): void {
    this.effects.createParticleBurst(x, y, z, color, count, this.elapsedTime)
  }

  createFloatingText(x: number, y: number, z: number, text: string, color: string): void {
    this.effects.createFloatingText(x, y, z, text, color, this.elapsedTime)
  }

  createSpawnBeam(x: number, z: number): void {
    this.effects.createSpawnBeam(x, z, this.elapsedTime)
  }

  // ── Dialogue Bubbles ──

  showDialogueBubble(
    id: string,
    text: string,
    agentPositions: Iterable<{ id: string; x: number; z: number }>
  ): void {
    const rs = this.agents.get(id)
    if (!rs) return

    if (rs.bubble) {
      rs.group.remove(rs.bubble)
      rs.bubble = null
    }
    if (rs.bubbleTimeout) {
      clearTimeout(rs.bubbleTimeout)
      rs.bubbleTimeout = null
    }

    let nearbyBubbles = 0
    for (const other of agentPositions) {
      if (other.id === id) continue
      const otherRs = this.agents.get(other.id)
      if (!otherRs?.bubble) continue
      const dx = other.x - rs.position.x
      const dz = other.z - rs.position.z
      if (Math.sqrt(dx * dx + dz * dz) < 3) nearbyBubbles++
    }

    const bubbleDiv = document.createElement('div')
    bubbleDiv.className = 'dialogue-bubble'
    bubbleDiv.textContent = text.slice(0, 80)
    const bubble = new CSS2DObject(bubbleDiv)
    const bubbleY = 2.8 + nearbyBubbles * 1.2
    bubble.position.set(0, bubbleY, 0)
    bubble.center.set(0.5, 1)
    rs.group.add(bubble)
    rs.bubble = bubble

    rs.bubbleTimeout = setTimeout(() => {
      bubbleDiv.classList.add('fading')
      setTimeout(() => {
        if (rs.bubble === bubble) {
          rs.group.remove(bubble)
          rs.bubble = null
        }
      }, 600)
    }, BUBBLE_DURATION - 600)
  }

  // ── Contract Scrolls ──

  createContractScroll(contract: ContractData): void {
    const zone = ZONES.questBoard
    const scrollDiv = document.createElement('div')
    scrollDiv.className = `contract-scroll difficulty-${contract.difficulty}`
    scrollDiv.textContent =
      contract.difficulty === 'hard'
        ? '\u{1F4DC}\u{2728}'
        : contract.difficulty === 'easy'
          ? '\u{1F4C4}'
          : '\u{1F4DC}'
    const label = new CSS2DObject(scrollDiv)
    label.position.set(
      zone.x + (Math.random() - 0.5) * 2,
      2 + Math.random(),
      zone.z + (Math.random() - 0.5) * 2
    )
    this.ctx.scene.add(label)
    this.contractScrolls.set(contract.id, label)
  }

  removeContractScroll(contractId: string): void {
    const scroll = this.contractScrolls.get(contractId)
    if (scroll) {
      this.ctx.scene.remove(scroll)
      this.contractScrolls.delete(contractId)
    }
  }

  // ── Per-Frame Update ──

  update(frame: FrameContext, agents: Iterable<AgentData>): void {
    this.elapsedTime = frame.elapsed
    const { elapsed, delta, now } = frame

    for (const agent of agents) {
      const rs = this.agents.get(agent.id)
      if (!rs) continue

      const wander = checkIdleWander(agent, rs.position.x, rs.position.z, now)
      if (wander.shouldWander && wander.target) {
        rs.targetPosition.set(wander.target.x, 0, wander.target.z)
      }

      const lerped = lerpPosition(
        rs.position.x,
        rs.position.z,
        rs.targetPosition.x,
        rs.targetPosition.z,
        delta
      )
      rs.position.x = lerped.x
      rs.position.z = lerped.z
      const dist = lerped.distance

      const bobScale = agent.status === 'idle' ? 1 : 0.4
      const bobY = Math.sin(elapsed * agent.bobSpeed + agent.bobPhase) * BOB_AMPLITUDE * bobScale
      rs.group.position.set(rs.position.x, bobY, rs.position.z)

      if (agent.status === 'idle') {
        rs.bodyMesh.rotation.y += IDLE_SPIN_SPEED * delta
      } else if (dist > 0.05) {
        const targetAngle = Math.atan2(
          rs.targetPosition.x - rs.position.x,
          rs.targetPosition.z - rs.position.z
        )
        const currentAngle = rs.bodyMesh.rotation.y
        rs.bodyMesh.rotation.y += (targetAngle - currentAngle) * Math.min(1, 4 * delta)
      }

      const glowMat = rs.glowMesh.material as THREE.MeshBasicMaterial
      if (agent.status === 'working') {
        glowMat.opacity = 0.4 + 0.3 * Math.sin(elapsed * GLOW_PULSE_SPEED)
      } else {
        glowMat.opacity = 0.5
      }

      const ringMat = rs.activityRing.material as THREE.MeshBasicMaterial
      if (agent.status === 'working') {
        const zoneColor = this.getNearestZoneColor(rs.position.x, rs.position.z)
        ringMat.color.set(zoneColor)
        ringMat.opacity = 0.3 + 0.3 * Math.sin(elapsed * 4)
        const ringScale = 1 + 0.15 * Math.sin(elapsed * 3)
        rs.activityRing.scale.set(ringScale, ringScale, 1)
      } else {
        ringMat.opacity = 0
      }
    }

    this.effects.update(frame)
  }

  // ── Raycasting ──

  getClickedAgentId(clientX: number, clientY: number): string | null {
    this.mouseVec.x = (clientX / window.innerWidth) * 2 - 1
    this.mouseVec.y = -(clientY / window.innerHeight) * 2 + 1
    this.raycaster.setFromCamera(this.mouseVec, this.ctx.camera)

    let closestId: string | null = null
    let closestDist = Infinity

    for (const [id, rs] of this.agents) {
      const intersects = this.raycaster.intersectObject(rs.bodyMesh)
      if (intersects.length > 0 && intersects[0]!.distance < closestDist) {
        closestDist = intersects[0]!.distance
        closestId = id
      }
    }

    return closestId
  }

  // ── Scene Lifecycle ──

  resize(width: number, height: number): void {
    this.ctx.camera.aspect = width / height
    this.ctx.camera.updateProjectionMatrix()
    this.ctx.renderer.setSize(width, height)
    this.ctx.cssRenderer.setSize(width, height)
  }

  render(): void {
    this.ctx.controls.update()
    this.ctx.renderer.render(this.ctx.scene, this.ctx.camera)
    this.ctx.cssRenderer.render(this.ctx.scene, this.ctx.camera)
  }

  startLoop(callback: () => void): void {
    this.ctx.renderer.setAnimationLoop(callback)
  }

  // ── Private Helpers ──

  private getNearestZoneColor(x: number, z: number): string {
    let closest: keyof typeof ZONES = 'center'
    let minDist = Infinity
    for (const [name, zone] of Object.entries(ZONES)) {
      const dx = x - zone.x
      const dz = z - zone.z
      const dist = dx * dx + dz * dz
      if (dist < minDist) {
        minDist = dist
        closest = name as keyof typeof ZONES
      }
    }
    return ZONES[closest].color
  }
}
