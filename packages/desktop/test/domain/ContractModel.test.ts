import { describe, expect, it } from 'bun:test'
import { detectDifficulty, taskToContract } from '../../src/mainview/domain/models/ContractModel'

describe('ContractModel', () => {
	describe('detectDifficulty', () => {
		it('detects hard tasks', () => {
			expect(detectDifficulty('Implement new auth system')).toBe('hard')
			expect(detectDifficulty('Rewrite the parser')).toBe('hard')
			expect(detectDifficulty('Redesign database architecture')).toBe('hard')
		})

		it('detects normal tasks', () => {
			expect(detectDifficulty('Refactor user module')).toBe('normal')
			expect(detectDifficulty('Add pagination support')).toBe('normal')
			expect(detectDifficulty('Create new endpoint')).toBe('normal')
			expect(detectDifficulty('Migrate to new API')).toBe('normal')
		})

		it('detects easy tasks', () => {
			expect(detectDifficulty('Fix typo in readme')).toBe('easy')
			expect(detectDifficulty('Rename variable')).toBe('easy')
			expect(detectDifficulty('Bump version')).toBe('easy')
		})

		it('defaults to normal for unmatched text', () => {
			expect(detectDifficulty('Something else entirely')).toBe('normal')
		})
	})

	describe('taskToContract', () => {
		it('creates a posted contract from unclaimed task', () => {
			const task = { id: '1', subject: 'Fix bug', status: 'pending' }
			const contract = taskToContract(task)
			expect(contract.id).toBe('1')
			expect(contract.title).toBe('Fix bug')
			expect(contract.status).toBe('posted')
			expect(contract.difficulty).toBe('easy')
			expect(contract.reward).toBe(10)
		})

		it('creates an active contract from assigned task', () => {
			const task = { id: '2', subject: 'Add feature', status: 'in_progress', assignee: 'agent-1' }
			const contract = taskToContract(task)
			expect(contract.status).toBe('active')
			expect(contract.assignee).toBe('agent-1')
		})

		it('creates a completed contract from completed task', () => {
			const task = { id: '3', subject: 'Implement login', status: 'completed', assignee: 'agent-1' }
			const contract = taskToContract(task)
			expect(contract.status).toBe('completed')
			expect(contract.difficulty).toBe('hard')
			expect(contract.reward).toBe(40)
		})

		it('preserves difficulty from existing contract', () => {
			const task = { id: '4', subject: 'Something', status: 'pending' }
			const existing = { id: '4', title: 'Something', status: 'posted' as const, difficulty: 'hard' as const, reward: 40 }
			const contract = taskToContract(task, existing)
			expect(contract.difficulty).toBe('hard')
			expect(contract.reward).toBe(40)
		})
	})
})
