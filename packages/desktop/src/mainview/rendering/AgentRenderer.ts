import * as Phaser from 'phaser'
import { classifyAgent } from '../constants'
import { computeSpawnPosition } from '../domain/models/AgentModel'
import { worldToScreen } from './IsoProjection'
import type { AgentRenderState, TeamMember } from '../types'

function hexToNumber(hex: string): number {
  return parseInt(hex.replace('#', ''), 16)
}

export function createAgentGraphics(
  scene: Phaser.Scene,
  member: TeamMember,
  spawnIndex: number,
  totalAgents: number
): AgentRenderState {
  const agentClass = classifyAgent(member.name, member.role)
  const color = hexToNumber(member.color)
  const { bodyScale, headSize } = agentClass

  // Body — isometric ellipse
  const bodyMesh = scene.add.graphics()
  bodyMesh.fillStyle(color, 1)
  bodyMesh.fillEllipse(0, 0, 30 * bodyScale.x, 20 * bodyScale.y)

  // Head — circle above body
  const headMesh = scene.add.graphics()
  headMesh.fillStyle(color, 1)
  headMesh.fillCircle(0, -15 * bodyScale.y, headSize * 40)

  // Glow — semi-transparent at base
  const glowMesh = scene.add.graphics()
  glowMesh.fillStyle(color, 0.5)
  glowMesh.fillCircle(0, 5, 14)

  // Activity ring — initially invisible
  const activityRing = scene.add.graphics()
  activityRing.lineStyle(2, color, 0)
  activityRing.strokeEllipse(0, 5, 26, 16)

  // Name label
  const labelText = `${agentClass.title} ${member.name}`
  const nameLabel = scene.add
    .text(0, -30, labelText, {
      fontSize: '11px',
      fontFamily: 'Space Grotesk, system-ui',
      color: member.color,
      align: 'center',
    })
    .setOrigin(0.5, 1)

  // Container with all elements
  const group = scene.add.container(0, 0, [glowMesh, activityRing, bodyMesh, headMesh, nameLabel])

  // Compute spawn position and convert to screen coords
  const spawn = computeSpawnPosition(spawnIndex, totalAgents)
  const screen = worldToScreen(spawn.x, spawn.z)
  group.setPosition(screen.x, screen.y)

  return {
    position: { x: screen.x, y: screen.y },
    targetPosition: { x: screen.x, y: screen.y },
    worldX: spawn.x,
    worldZ: spawn.z,
    targetWorldX: spawn.x,
    targetWorldZ: spawn.z,
    group,
    bodyMesh,
    glowMesh,
    nameLabel,
    bubble: null,
    bubbleTimeout: null,
    activityRing,
    headMesh,
  }
}
