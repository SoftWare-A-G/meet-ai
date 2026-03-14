import type { AgentData, StoredTask } from '../types'
import type { ContractData, IGameState } from './interfaces/IGameState'
import { EventLog } from './models/EventLog'
import { ZoneTracker } from '../domain/services/ZoneTracker'

export class GameState implements IGameState {
	private agents = new Map<string, AgentData>()
	private tasks = new Map<string, StoredTask>()
	private contracts = new Map<string, ContractData>()

	selectedAgentId: string | null = null
	roomName = ''
	eventLogVisible = false
	readonly eventLog = new EventLog()
	readonly zoneTracker = new ZoneTracker()

	// Agents
	getAgent(id: string): AgentData | undefined { return this.agents.get(id) }
	getAllAgents(): Iterable<AgentData> { return this.agents.values() }
	setAgent(id: string, data: AgentData): void { this.agents.set(id, data) }
	removeAgent(id: string): void { this.agents.delete(id) }
	agentCount(): number { return this.agents.size }

	// Tasks
	getTask(id: string): StoredTask | undefined { return this.tasks.get(id) }
	getAllTasks(): Iterable<StoredTask> { return this.tasks.values() }
	setTask(id: string, task: StoredTask): void { this.tasks.set(id, task) }

	// Contracts
	getContract(id: string): ContractData | undefined { return this.contracts.get(id) }
	getAllContracts(): Iterable<ContractData> { return this.contracts.values() }
	setContract(id: string, contract: ContractData): void { this.contracts.set(id, contract) }
	removeContract(id: string): void { this.contracts.delete(id) }
}
