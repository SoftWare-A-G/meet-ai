import type { StoredTask } from '../../types'
import type { ContractData } from '../interfaces/IGameState'
import { taskToContract as domainTaskToContract } from '../models/ContractModel'
import type { GameActions } from './GameActions'

export class HandleTasks {
	constructor(private readonly actions: GameActions) {}

	execute(data: { tasks: StoredTask[] }): void {
		const { state, scene } = this.actions

		for (const task of data.tasks) {
			const existingTask = state.getTask(task.id)
			const existingContract = state.getContract(task.id)
			const contract: ContractData = domainTaskToContract(task, existingContract ?? undefined)
			const justCompleted = existingTask && existingTask.status !== 'completed' && task.status === 'completed'

			if (!existingContract && !task.assignee) {
				scene.createContractScroll(contract)
				this.actions.addEvent('Guild', `New contract: ${task.subject}`, 'task')
			}

			if (existingContract?.status === 'posted' && task.assignee) {
				scene.removeContractScroll(contract.id)
				for (const agent of state.getAllAgents()) {
					if (agent.name === task.assignee || agent.id === task.assignee) {
						const pos = scene.getAgentPosition(agent.id)
						if (pos) scene.createFloatingText(pos.x, 0, pos.z, 'Contract Claimed!', '#a855f7')
						this.actions.addEvent(agent.name, `Claimed: ${task.subject}`, 'task')
						break
					}
				}
			}

			state.setContract(task.id, contract)
			state.setTask(task.id, task)

			if (!task.assignee) continue

			for (const agent of state.getAllAgents()) {
				if (agent.name !== task.assignee && agent.id !== task.assignee) continue

				if (justCompleted) {
					agent.status = 'idle'
					scene.setAgentGlow(agent.id, agent.status)
					this.actions.moveAgentToZone(agent.id, 'center')
					scene.removeContractScroll(contract.id)
					const reward = contract.reward
					this.actions.addXP(agent.id, reward)
					agent.tasksCompleted++
					agent.mood = Math.min(100, agent.mood + 10)
					agent.fatigue = Math.max(0, agent.fatigue - 5)
					const pos = scene.getAgentPosition(agent.id)
					if (pos) {
						scene.createParticleBurst(pos.x, 0, pos.z, 0xffdd00, 25)
						scene.createFloatingText(pos.x, 0, pos.z, `+${reward} XP (${contract.difficulty})`, '#ffd700')
					}
					contract.status = 'completed'
					state.setContract(task.id, contract)
					this.actions.addEvent(agent.name, `Completed: ${task.subject} (+${reward}XP)`, 'task')
				} else {
					this.actions.moveAgentToZone(agent.id, 'questBoard')
				}
			}
		}
		this.actions.computeHUD()
	}
}
