import { DIFFICULTY_REWARDS } from '../../constants'
import type { StoredTask } from '../../types'
import type { ContractData } from '../interfaces/IGameState'

export function detectDifficulty(text: string): 'easy' | 'normal' | 'hard' {
	const lower = text.toLowerCase()
	if (['implement', 'rewrite', 'architecture', 'system', 'redesign'].some(k => lower.includes(k))) return 'hard'
	if (['refactor', 'update', 'add', 'create', 'migrate'].some(k => lower.includes(k))) return 'normal'
	if (['fix', 'typo', 'rename', 'bump', 'tweak'].some(k => lower.includes(k))) return 'easy'
	return 'normal'
}

export function taskToContract(task: StoredTask, existing?: ContractData): ContractData {
	const text = `${task.subject} ${task.description || ''}`
	const difficulty = existing?.difficulty || detectDifficulty(text)
	let status: ContractData['status'] = 'posted'
	if (task.status === 'completed') status = 'completed'
	else if (task.assignee) status = 'active'
	return {
		id: task.id,
		title: task.subject,
		assignee: task.assignee,
		status,
		difficulty,
		reward: DIFFICULTY_REWARDS[difficulty],
	}
}
