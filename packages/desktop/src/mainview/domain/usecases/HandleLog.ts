import { FATIGUE_TOOL_COST } from '../../constants'
import { routeToolToZone } from '../services/ToolRouter'
import type { GameActions } from './GameActions'

export class HandleLog {
	constructor(private readonly actions: GameActions) {}

	execute(data: { sender: string; content: string }): void {
		const { state, scene } = this.actions

		for (const agent of state.getAllAgents()) {
			if (agent.name === data.sender) {
				agent.status = 'working'
				agent.lastActivity = Date.now()
				scene.setAgentGlow(agent.id, agent.status)

				const now = Date.now()
				if (now - agent.lastToolXpTime > 2000) {
					this.actions.addXP(agent.id, 5)
					agent.toolUses++
					agent.lastToolXpTime = now
				}

				agent.fatigue = Math.min(100, agent.fatigue + FATIGUE_TOOL_COST)
				const zoneName = routeToolToZone(data.content)
				if (zoneName) {
					this.actions.moveAgentToZone(agent.id, zoneName)
					state.zoneTracker.recordUse(agent.id, zoneName)
					const focusResult = state.zoneTracker.updateZoneFocus(agent.id, zoneName, agent.focus)
					agent.focus = focusResult.newFocus
				}

				this.actions.addEvent(agent.name, data.content.slice(0, 50), 'tool')
				break
			}
		}
	}
}
