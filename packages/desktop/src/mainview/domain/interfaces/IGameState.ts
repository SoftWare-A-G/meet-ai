import type { AgentData, StoredTask } from '../../types'
import type { EventLog } from '../models/EventLog'
import type { ZoneTracker } from '../services/ZoneTracker'

// Pure contract data — no Three.js types (scrollObject lives in rendering)
export interface ContractData {
  id: string
  title: string
  assignee?: string
  status: 'posted' | 'claimed' | 'active' | 'completed' | 'failed'
  difficulty: 'easy' | 'normal' | 'hard'
  reward: number
}

export interface IGameState {
  // Agents
  getAgent(id: string): AgentData | undefined
  getAllAgents(): Iterable<AgentData>
  setAgent(id: string, data: AgentData): void
  removeAgent(id: string): void
  agentCount(): number
  selectedAgentId: string | null

  // Tasks
  getTask(id: string): StoredTask | undefined
  getAllTasks(): Iterable<StoredTask>
  setTask(id: string, task: StoredTask): void

  // Contracts
  getContract(id: string): ContractData | undefined
  getAllContracts(): Iterable<ContractData>
  setContract(id: string, contract: ContractData): void
  removeContract(id: string): void

  // Meta
  roomName: string
  eventLog: EventLog
  zoneTracker: ZoneTracker
  eventLogVisible: boolean
}
