import type { AgentData, FrameContext } from '../../types'

export interface StatDecayResult {
	idleTimeout: boolean
}

// Per-frame stat decay/recovery — mutates agent data in place
export function updateAgentStats(agent: AgentData, frame: FrameContext): StatDecayResult {
	const IDLE_TIMEOUT = 30000
	let idleTimeout = false

	// Idle timeout — 30s without activity
	if (agent.status !== 'idle' && frame.now - agent.lastActivity > IDLE_TIMEOUT) {
		agent.status = 'idle'
		idleTimeout = true
	}

	// Stats decay/recovery (per frame, scaled by delta)
	if (agent.status === 'working') {
		agent.fatigue = Math.min(100, agent.fatigue + frame.delta * 1.5)
		agent.focus = Math.max(0, agent.focus - frame.delta * 0.8)
		if (agent.fatigue > 80) agent.mood = Math.max(0, agent.mood - frame.delta * 0.5)
	} else if (agent.status === 'idle') {
		agent.fatigue = Math.max(0, agent.fatigue - frame.delta * 3)
		agent.focus = Math.min(100, agent.focus + frame.delta * 2)
		agent.mood = Math.min(100, agent.mood + frame.delta * 0.3)
	}

	// Boost expires
	if (agent.boosted && frame.now > agent.boostEndTime) {
		agent.boosted = false
	}

	return { idleTimeout }
}
