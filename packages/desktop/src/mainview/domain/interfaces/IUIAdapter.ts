import type { AgentData, EventLogEntry } from '../../types'

// UI adapter contract — all DOM operations the domain/usecases can request.
// Implementation: adapters/DOMUIAdapter.ts

export interface HUDData {
	totalXP: number
	mvpName: string
	mvpXP: number
	activeTasks: number
	completedTasks: number
	guildLevel: number
	reputation: string
}

export interface IUIAdapter {
	setRoomTitle(title: string): void
	updateAgentCount(active: number, total: number): void
	updateHUD(data: HUDData): void
	showAgentPanel(agent: AgentData, specialty: { name: string; icon: string }, onAction: (action: string) => void): void
	hideAgentPanel(): void
	refreshEventLog(entries: readonly EventLogEntry[]): void
	toggleEventLog(visible: boolean): void
}
