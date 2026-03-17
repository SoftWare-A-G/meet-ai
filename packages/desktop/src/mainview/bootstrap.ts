import { DOMUIAdapter } from './adapters/DOMUIAdapter'
import { initRPC } from './adapters/RPCAdapter'
import { PhaserSceneAdapter } from './adapters/PhaserSceneAdapter'
import { GameState } from './domain/GameState'
import { GameActions } from './domain/usecases/GameActions'
import { HandleLog } from './domain/usecases/HandleLog'
import { HandleMessage } from './domain/usecases/HandleMessage'
import { HandleTasks } from './domain/usecases/HandleTasks'
import { HandleTeamInfo } from './domain/usecases/HandleTeamInfo'
import { UpdateGameTick } from './domain/usecases/UpdateGameTick'
import { initInputHandler, refreshSelectedAgentPanel } from './ui/InputHandler'

// Manual DI container — mirrors CLI's createContainer() pattern.
export function createGame(): void {
	// State
	const state = new GameState()

	// Adapters (PhaserSceneAdapter owns all rendering setup internally)
	const sceneAdapter = new PhaserSceneAdapter()
	const uiAdapter = new DOMUIAdapter()

	// Shared actions
	const actions = new GameActions(state, sceneAdapter, uiAdapter)

	// Usecases
	const handleTeamInfo = new HandleTeamInfo(actions)
	const handleMessage = new HandleMessage(actions)
	const handleLog = new HandleLog(actions)
	const handleTasks = new HandleTasks(actions)
	const updateGameTick = new UpdateGameTick(actions)

	// RPC
	initRPC({ handleTeamInfo, handleMessage, handleLog, handleTasks })

	// Input
	initInputHandler(sceneAdapter.canvas, state, sceneAdapter, uiAdapter, actions)

	// Game loop
	let lastFrameTime = performance.now()
	let elapsedTime = 0

	sceneAdapter.startLoop(() => {
		const now_ms = performance.now()
		const delta = Math.min((now_ms - lastFrameTime) / 1000, 0.05)
		lastFrameTime = now_ms
		elapsedTime += delta
		const elapsed = elapsedTime
		const now = Date.now()

		const frame = { elapsed, delta, now }
		updateGameTick.execute(frame)

		if (state.selectedAgentId && Math.floor(elapsed * 2) !== Math.floor((elapsed - delta) * 2)) {
			refreshSelectedAgentPanel(state, uiAdapter)
		}

		sceneAdapter.render()
	})
}
