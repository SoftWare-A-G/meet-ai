import type { FrameContext } from '../../types'
import { classifyAgent } from '../../constants'
import { updateAgentStats } from '../services/StatEngine'
import type { GameActions } from './GameActions'

export class UpdateGameTick {
	constructor(private readonly actions: GameActions) {}

	execute(frame: FrameContext): void {
		const { state, scene } = this.actions

		for (const agent of state.getAllAgents()) {
			const wasBoosted = agent.boosted
			const statResult = updateAgentStats(agent, frame)
			if (statResult.idleTimeout) {
				scene.setAgentGlow(agent.id, agent.status)
				this.actions.moveAgentToZone(agent.id, 'center')
			}
			if (wasBoosted && !agent.boosted) {
				scene.setAgentEmissiveIntensity(agent.id, classifyAgent(agent.name, agent.role).emissiveIntensity)
			}

			// Visual: dim agent when fatigued
			const fatigueScale = 1.0 - (agent.fatigue / 100) * 0.4
			scene.setAgentFatigueDim(agent.id, agent.color, fatigueScale)
		}

		// Scene update: movement, bobbing, glow, effects
		scene.update(frame, state.getAllAgents())
	}
}
