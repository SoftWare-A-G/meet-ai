import type { ISceneAdapter } from '../domain/interfaces/ISceneAdapter'
import type { IUIAdapter } from '../domain/interfaces/IUIAdapter'
import type { IGameState } from '../domain/interfaces/IGameState'
import { ZONES } from '../constants'
import { getAgentSpecialty } from '../domain/services/AgentClassifier'
import type { GameActions } from '../domain/usecases/GameActions'

export function initInputHandler(
	canvas: HTMLCanvasElement,
	state: IGameState,
	sceneAdapter: ISceneAdapter,
	uiAdapter: IUIAdapter,
	actions: GameActions,
): void {
	// Click detection — raycast to find clicked agent
	canvas.addEventListener('click', (event) => {
		const clickedId = sceneAdapter.getClickedAgentId(event.clientX, event.clientY)
		if (clickedId) {
			state.selectedAgentId = clickedId
			showAgentPanelForId(clickedId)
		} else {
			state.selectedAgentId = null
			uiAdapter.hideAgentPanel()
		}
	})

	// Keyboard shortcuts
	window.addEventListener('keydown', (e: KeyboardEvent) => {
		if (e.key === 'l' || e.key === 'L') {
			state.eventLogVisible = !state.eventLogVisible
			uiAdapter.toggleEventLog(state.eventLogVisible)
		}
	})

	// Resize
	window.addEventListener('resize', () => {
		sceneAdapter.resize(window.innerWidth, window.innerHeight)
	})

	function showAgentPanelForId(agentId: string) {
		const agent = state.getAgent(agentId)
		if (!agent) return
		const spec = getAgentSpecialty(state.zoneTracker.getUsage(agentId))
		uiAdapter.showAgentPanel(agent, spec, (action) => handleAgentAction(agentId, action))
	}

	function handleAgentAction(agentId: string, action: string) {
		const agent = state.getAgent(agentId)
		if (!agent) return
		const pos = sceneAdapter.getAgentPosition(agentId)

		if (action === 'boost') {
			agent.boosted = true
			agent.boostEndTime = Date.now() + 15000
			agent.focus = Math.min(100, agent.focus + 30)
			sceneAdapter.setAgentEmissiveIntensity(agentId, 0.6)
			if (pos) {
				sceneAdapter.createParticleBurst(pos.x, 0, pos.z, 0xffd700, 15)
				sceneAdapter.createFloatingText(pos.x, 0, pos.z, '⚡ Boosted!', '#ffd700')
			}
		} else if (action === 'recover') {
			agent.fatigue = Math.max(0, agent.fatigue - 30)
			agent.mood = Math.min(100, agent.mood + 15)
			agent.focus = Math.min(100, agent.focus + 15)
			if (pos) {
				sceneAdapter.createParticleBurst(pos.x, 0, pos.z, 0x22c55e, 15)
				sceneAdapter.createFloatingText(pos.x, 0, pos.z, '💚 Recovered!', '#22c55e')
			}
		} else if (action === 'reroute') {
			const zoneNames: (keyof typeof ZONES)[] = ['library', 'workshop', 'terminal', 'questBoard', 'center']
			const random = zoneNames[Math.floor(Math.random() * zoneNames.length)]!
			actions.moveAgentToZone(agentId, random)
			if (pos) sceneAdapter.createFloatingText(pos.x, 0, pos.z, `🔀 → ${ZONES[random].label}`, '#3b82f6')
		}
	}
}

// Exported for use in bootstrap.ts game loop panel refresh
export function refreshSelectedAgentPanel(
	state: IGameState,
	uiAdapter: IUIAdapter,
): void {
	if (!state.selectedAgentId) return
	const agent = state.getAgent(state.selectedAgentId)
	if (!agent) { uiAdapter.hideAgentPanel(); return }
	const spec = getAgentSpecialty(state.zoneTracker.getUsage(state.selectedAgentId))
	// Read-only refresh — no action handler needed since panel already has listeners
	uiAdapter.showAgentPanel(agent, spec, () => {})
}
