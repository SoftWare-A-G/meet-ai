import type { AgentData } from '../../types'
import {
	BOB_FREQUENCY,
	LERP_SPEED,
	SPAWN_RADIUS,
	WANDER_INTERVAL_MIN,
	WANDER_INTERVAL_MAX,
	WANDER_RADIUS,
	ZONE_SCATTER_RADIUS,
	ZONES,
} from '../../constants'
export interface XPResult {
	leveledUp: boolean
	newLevel: number
}

export function getLevel(xp: number): number {
	return Math.floor(Math.sqrt(xp / 10)) + 1
}

export function addXP(agent: AgentData, amount: number): XPResult {
	const oldLevel = agent.level
	agent.xp += amount
	agent.level = getLevel(agent.xp)
	return {
		leveledUp: agent.level > oldLevel,
		newLevel: agent.level,
	}
}

export function createAgentData(
	id: string,
	name: string,
	color: string,
	role: string,
	status: 'active' | 'inactive',
	spawnIndex: number,
): AgentData {
	return {
		id,
		name,
		color,
		role,
		status: status === 'active' ? 'working' : 'idle',
		xp: 0,
		level: 1,
		focus: 100,
		fatigue: 0,
		mood: 75,
		tasksCompleted: 0,
		messagesCount: 0,
		toolUses: 0,
		boosted: false,
		boostEndTime: 0,
		bobPhase: Math.random() * Math.PI * 2,
		bobSpeed: BOB_FREQUENCY * (0.8 + Math.random() * 0.4),
		lastActivity: Date.now(),
		spawnIndex,
		nextWanderTime: Date.now() + WANDER_INTERVAL_MIN + Math.random() * (WANDER_INTERVAL_MAX - WANDER_INTERVAL_MIN),
		lastToolXpTime: 0,
	}
}

export function computeSpawnPosition(spawnIndex: number, totalAgents: number): { x: number; z: number } {
	const angle = (spawnIndex / Math.max(totalAgents, 1)) * Math.PI * 2
	return {
		x: Math.cos(angle) * SPAWN_RADIUS,
		z: Math.sin(angle) * SPAWN_RADIUS,
	}
}

export function computeZoneTarget(zoneName: keyof typeof ZONES): { x: number; z: number } {
	const zone = ZONES[zoneName]
	return {
		x: zone.x + (Math.random() - 0.5) * ZONE_SCATTER_RADIUS * 2,
		z: zone.z + (Math.random() - 0.5) * ZONE_SCATTER_RADIUS * 2,
	}
}

export function computeWanderTarget(posX: number, posZ: number): { x: number; z: number } {
	return {
		x: posX + (Math.random() - 0.5) * WANDER_RADIUS * 2,
		z: posZ + (Math.random() - 0.5) * WANDER_RADIUS * 2,
	}
}

export function computeNextWanderTime(): number {
	return Date.now() + WANDER_INTERVAL_MIN + Math.random() * (WANDER_INTERVAL_MAX - WANDER_INTERVAL_MIN)
}

export interface WanderCheck {
	shouldWander: boolean
	target?: { x: number; z: number }
}

/** Check if an idle agent is due for a wander and return the new target if so. */
export function checkIdleWander(agent: AgentData, posX: number, posZ: number, now: number): WanderCheck {
	if (agent.status !== 'idle' || now <= agent.nextWanderTime) {
		return { shouldWander: false }
	}
	const target = computeWanderTarget(posX, posZ)
	agent.nextWanderTime = computeNextWanderTime()
	return { shouldWander: true, target }
}

export function lerpPosition(
	posX: number, posZ: number,
	targetX: number, targetZ: number,
	delta: number,
): { x: number; z: number; distance: number } {
	const dx = targetX - posX
	const dz = targetZ - posZ
	const dist = Math.sqrt(dx * dx + dz * dz)

	if (dist > 0.01) {
		const t = Math.min(1, LERP_SPEED * delta)
		return { x: posX + dx * t, z: posZ + dz * t, distance: dist }
	}
	return { x: targetX, z: targetZ, distance: 0 }
}
