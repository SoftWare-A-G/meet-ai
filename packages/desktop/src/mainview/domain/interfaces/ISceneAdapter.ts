import type { AgentData, FrameContext, TeamMember } from '../../types'
import type { ContractData } from './IGameState'

// Scene adapter contract — all Three.js operations the domain/usecases can request.
// Implementation: adapters/ThreeSceneAdapter.ts
// rendering/* modules are PRIVATE internals of the adapter — never imported by domain.

export interface ISceneAdapter {
	// Agent lifecycle
	createAgent(member: TeamMember, spawnIndex: number, totalAgents: number): void
	removeAgent(id: string): void

	// Agent visual updates
	updateAgentColor(id: string, color: string): void
	updateAgentLabel(id: string, labelText: string): void
	updateAgentLabelColor(id: string, color: string): void
	setAgentGlow(id: string, status: AgentData['status']): void
	setAgentEmissiveIntensity(id: string, intensity: number): void
	setAgentFatigueDim(id: string, color: string, fatigueScale: number): void

	// Agent movement
	setAgentTargetPosition(id: string, x: number, z: number): void
	getAgentPosition(id: string): { x: number; z: number } | undefined

	// Effects
	createParticleBurst(x: number, y: number, z: number, color: number, count: number): void
	createFloatingText(x: number, y: number, z: number, text: string, color: string): void
	createSpawnBeam(x: number, z: number): void

	// Dialogue bubbles
	showDialogueBubble(id: string, text: string, agentPositions: Iterable<{ id: string; x: number; z: number }>): void

	// Contract scrolls
	createContractScroll(contract: ContractData): void
	removeContractScroll(contractId: string): void

	// Per-frame animation update
	update(frame: FrameContext, agents: Iterable<AgentData>): void

	// Raycasting
	getClickedAgentId(clientX: number, clientY: number): string | null

	// Scene lifecycle
	readonly canvas: HTMLCanvasElement
	resize(width: number, height: number): void
	render(): void
	startLoop(callback: () => void): void
}
