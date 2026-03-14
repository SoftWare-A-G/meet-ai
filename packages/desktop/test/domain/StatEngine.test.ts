import { describe, expect, it } from 'bun:test'
import { updateAgentStats } from '../../src/mainview/domain/services/StatEngine'
import type { AgentData } from '../../src/mainview/types'

function makeAgent(overrides: Partial<AgentData> = {}): AgentData {
	return {
		id: 'test',
		name: 'test-agent',
		color: '#ff0000',
		role: 'worker',
		status: 'working',
		xp: 0,
		level: 1,
		focus: 50,
		fatigue: 50,
		mood: 50,
		tasksCompleted: 0,
		messagesCount: 0,
		toolUses: 0,
		boosted: false,
		boostEndTime: 0,
		bobPhase: 0,
		bobSpeed: 2,
		lastActivity: Date.now(),
		spawnIndex: 0,
		nextWanderTime: Date.now() + 10000,
		lastToolXpTime: 0,
		...overrides,
	}
}

describe('StatEngine', () => {
	describe('idle timeout', () => {
		it('sets agent to idle after 30s inactivity', () => {
			const agent = makeAgent({ status: 'working', lastActivity: Date.now() - 31000 })
			const result = updateAgentStats(agent, { elapsed: 0, delta: 0.016, now: Date.now() })
			expect(agent.status).toBe('idle')
			expect(result.idleTimeout).toBe(true)
		})

		it('does not timeout active agents', () => {
			const agent = makeAgent({ status: 'working', lastActivity: Date.now() })
			const result = updateAgentStats(agent, { elapsed: 0, delta: 0.016, now: Date.now() })
			expect(agent.status).toBe('working')
			expect(result.idleTimeout).toBe(false)
		})

		it('does not timeout already idle agents', () => {
			const agent = makeAgent({ status: 'idle', lastActivity: Date.now() - 60000 })
			const result = updateAgentStats(agent, { elapsed: 0, delta: 0.016, now: Date.now() })
			expect(agent.status).toBe('idle')
			expect(result.idleTimeout).toBe(false)
		})
	})

	describe('working stats decay', () => {
		it('increases fatigue when working', () => {
			const agent = makeAgent({ status: 'working', fatigue: 50 })
			updateAgentStats(agent, { elapsed: 0, delta: 1.0, now: Date.now() })
			expect(agent.fatigue).toBeGreaterThan(50)
		})

		it('decreases focus when working', () => {
			const agent = makeAgent({ status: 'working', focus: 50 })
			updateAgentStats(agent, { elapsed: 0, delta: 1.0, now: Date.now() })
			expect(agent.focus).toBeLessThan(50)
		})

		it('decreases mood when highly fatigued', () => {
			const agent = makeAgent({ status: 'working', fatigue: 85, mood: 50 })
			updateAgentStats(agent, { elapsed: 0, delta: 1.0, now: Date.now() })
			expect(agent.mood).toBeLessThan(50)
		})
	})

	describe('idle recovery', () => {
		it('recovers fatigue when idle', () => {
			const agent = makeAgent({ status: 'idle', fatigue: 50 })
			updateAgentStats(agent, { elapsed: 0, delta: 1.0, now: Date.now() })
			expect(agent.fatigue).toBeLessThan(50)
		})

		it('recovers focus when idle', () => {
			const agent = makeAgent({ status: 'idle', focus: 50 })
			updateAgentStats(agent, { elapsed: 0, delta: 1.0, now: Date.now() })
			expect(agent.focus).toBeGreaterThan(50)
		})

		it('improves mood when idle', () => {
			const agent = makeAgent({ status: 'idle', mood: 50 })
			updateAgentStats(agent, { elapsed: 0, delta: 1.0, now: Date.now() })
			expect(agent.mood).toBeGreaterThan(50)
		})
	})

	describe('boost expiry', () => {
		it('clears boost when expired', () => {
			const agent = makeAgent({ boosted: true, boostEndTime: Date.now() - 1000 })
			updateAgentStats(agent, { elapsed: 0, delta: 0.016, now: Date.now() })
			expect(agent.boosted).toBe(false)
		})

		it('keeps boost when not expired', () => {
			const agent = makeAgent({ boosted: true, boostEndTime: Date.now() + 10000 })
			updateAgentStats(agent, { elapsed: 0, delta: 0.016, now: Date.now() })
			expect(agent.boosted).toBe(true)
		})
	})

	describe('stat clamping', () => {
		it('clamps fatigue to 100', () => {
			const agent = makeAgent({ status: 'working', fatigue: 99.5 })
			updateAgentStats(agent, { elapsed: 0, delta: 1.0, now: Date.now() })
			expect(agent.fatigue).toBeLessThanOrEqual(100)
		})

		it('clamps fatigue to 0', () => {
			const agent = makeAgent({ status: 'idle', fatigue: 0.5 })
			updateAgentStats(agent, { elapsed: 0, delta: 1.0, now: Date.now() })
			expect(agent.fatigue).toBeGreaterThanOrEqual(0)
		})
	})
})
