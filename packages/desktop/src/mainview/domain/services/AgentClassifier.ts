import { SPECIALTY_MAP } from '../../constants'
import type { AgentData } from '../../types'

export type SpecialtyInfo = { name: string; icon: string }

export function getAgentSpecialty(zoneUsage: Record<string, number> | undefined): SpecialtyInfo {
	if (!zoneUsage) return { name: 'Wanderer', icon: '\u{1F6B6}' }
	let maxZone = ''
	let maxCount = 0
	for (const [zone, count] of Object.entries(zoneUsage)) {
		if (count > maxCount) { maxCount = count; maxZone = zone }
	}
	if (maxZone && maxCount > 3) {
		const spec = SPECIALTY_MAP[maxZone]
		if (spec) return spec
	}
	return { name: 'Wanderer', icon: '\u{1F6B6}' }
}

export function getMoodLabel(agent: Pick<AgentData, 'fatigue' | 'focus' | 'mood'>): string {
	if (agent.fatigue > 80) return 'exhausted'
	if (agent.focus > 70) return 'focused'
	if (agent.fatigue > 50 || agent.mood < 30) return 'stressed'
	return 'calm'
}

export function getMoodEmoji(label: string): string {
	const map: Record<string, string> = { calm: '\u{1F60C}', focused: '\u{1F525}', stressed: '\u{1F612}', exhausted: '\u{1F634}' }
	return map[label] || '\u{1F60C}'
}
