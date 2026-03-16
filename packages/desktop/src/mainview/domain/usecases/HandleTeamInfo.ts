import { SPAWN_RADIUS } from '../../constants'
import { createAgentData, computeSpawnPosition } from '../models/AgentModel'
import type { TeamMember } from '../../types'
import type { GameActions } from './GameActions'

export class HandleTeamInfo {
  constructor(private readonly actions: GameActions) {}

  execute(data: { team_name: string; members: TeamMember[] }): void {
    const { state, scene, ui } = this.actions
    state.roomName = data.team_name
    ui.setRoomTitle(state.roomName)

    for (const member of data.members) {
      const existing = state.getAgent(member.teammate_id)
      if (existing) {
        existing.name = member.name
        existing.color = member.color
        existing.role = member.role
        existing.status = member.status === 'active' ? 'working' : 'idle'
        existing.lastActivity = Date.now()
        scene.updateAgentColor(member.teammate_id, member.color)
        scene.updateAgentLabel(
          member.teammate_id,
          this.actions.getAgentLabelText(existing.name, existing.role, existing.level, existing.id)
        )
        scene.updateAgentLabelColor(member.teammate_id, member.color)
        scene.setAgentGlow(member.teammate_id, existing.status)
      } else {
        const spawnIndex = state.agentCount()
        const totalAgents = spawnIndex + 1
        const agentData = createAgentData(
          member.teammate_id,
          member.name,
          member.color,
          member.role,
          member.status,
          spawnIndex
        )
        state.setAgent(member.teammate_id, agentData)
        scene.createAgent(member, spawnIndex, totalAgents)
        scene.setAgentGlow(member.teammate_id, agentData.status)
        this.actions.addEvent(member.name, 'joined the guild', 'task')
        const spawn = computeSpawnPosition(spawnIndex, totalAgents)
        scene.createSpawnBeam(spawn.x, spawn.z)
      }
    }

    // Rebalance idle agents in a circle
    const idleAgents = [...state.getAllAgents()].filter(a => a.status === 'idle')
    if (idleAgents.length > 1) {
      for (const [i, agent] of idleAgents.entries()) {
        const angle = (i / idleAgents.length) * Math.PI * 2
        scene.setAgentTargetPosition(
          agent.id,
          Math.cos(angle) * SPAWN_RADIUS,
          Math.sin(angle) * SPAWN_RADIUS
        )
      }
    }

    this.actions.updateAgentCount()
    this.actions.computeHUD()
  }
}
