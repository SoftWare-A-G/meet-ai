import type { GameActions } from './GameActions'

export class HandleMessage {
	constructor(private readonly actions: GameActions) {}

	execute(data: { sender: string; content: string }): void {
		const { state, scene } = this.actions

		for (const agent of state.getAllAgents()) {
			if (agent.name === data.sender) {
				agent.status = 'talking'
				agent.lastActivity = Date.now()
				scene.setAgentGlow(agent.id, agent.status)

				const agentPositions = [...state.getAllAgents()].map(a => {
					const pos = scene.getAgentPosition(a.id)
					return { id: a.id, x: pos?.x ?? 0, z: pos?.z ?? 0 }
				})
				scene.showDialogueBubble(agent.id, data.content, agentPositions)

				this.actions.addXP(agent.id, 3)
				agent.messagesCount++
				agent.mood = Math.min(100, agent.mood + 2)
				this.actions.addEvent(agent.name, data.content.slice(0, 50), 'message')
				break
			}
		}
	}
}
