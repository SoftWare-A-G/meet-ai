import type { IGameState } from '../interfaces/IGameState'
import type { ISceneAdapter } from '../interfaces/ISceneAdapter'
import type { IUIAdapter } from '../interfaces/IUIAdapter'
import type { ZONES } from '../../constants'
import { classifyAgent } from '../../constants'
import { getGuildLevel, getGuildReputation } from '../models/GuildModel'
import { getAgentSpecialty } from '../services/AgentClassifier'
import { addXP as domainAddXP, computeZoneTarget } from '../models/AgentModel'

// Shared actions used by multiple usecases — injected with adapters.
export class GameActions {
	constructor(
		readonly state: IGameState,
		readonly scene: ISceneAdapter,
		readonly ui: IUIAdapter,
	) {}

	getAgentLabelText(name: string, role: string, level: number, agentId: string): string {
		const cls = classifyAgent(name, role)
		const spec = getAgentSpecialty(this.state.zoneTracker.getUsage(agentId))
		return `${cls.title} ${name} Lv.${level} ${spec.name}`
	}

	computeHUD(): void {
		let totalXP = 0
		let mvpName = '\u2014'
		let mvpXP = 0
		for (const agent of this.state.getAllAgents()) {
			totalXP += agent.xp
			if (agent.xp > mvpXP) { mvpXP = agent.xp; mvpName = agent.name }
		}
		const activeTasks = [...this.state.getAllTasks()].filter(t => t.status !== 'completed').length
		const completedTasks = [...this.state.getAllTasks()].filter(t => t.status === 'completed').length
		const guildLv = getGuildLevel(totalXP)
		const reputation = getGuildReputation(guildLv)
		this.ui.updateHUD({ totalXP, mvpName, mvpXP, activeTasks, completedTasks, guildLevel: guildLv, reputation })
	}

	updateAgentCount(): void {
		const active = [...this.state.getAllAgents()].filter(a => a.status !== 'idle').length
		this.ui.updateAgentCount(active, this.state.agentCount())
	}

	addEvent(agentName: string, text: string, type: 'tool' | 'message' | 'task' | 'error'): void {
		this.state.eventLog.add(agentName, text, type)
		this.ui.refreshEventLog(this.state.eventLog.getAll())
	}

	addXP(agentId: string, amount: number): void {
		const agent = this.state.getAgent(agentId)
		if (!agent) return
		const result = domainAddXP(agent, amount)
		this.scene.updateAgentLabel(agentId, this.getAgentLabelText(agent.name, agent.role, agent.level, agentId))

		if (result.leveledUp) {
			const pos = this.scene.getAgentPosition(agentId)
			if (pos) {
				this.scene.setAgentEmissiveIntensity(agentId, 1)
				this.scene.createParticleBurst(pos.x, 0, pos.z, 0xffd700, 30)
				this.scene.createFloatingText(pos.x, 0, pos.z, `Level ${result.newLevel}!`, '#ffd700')
				setTimeout(() => this.scene.setAgentEmissiveIntensity(agentId, 0.15), 1000)
			}
		}
		this.computeHUD()
	}

	moveAgentToZone(agentId: string, zoneName: keyof typeof ZONES): void {
		const target = computeZoneTarget(zoneName)
		this.scene.setAgentTargetPosition(agentId, target.x, target.z)
	}
}
