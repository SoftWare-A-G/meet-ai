import { FOCUS_GAIN_PER_USE, FOCUS_MAX } from '../../constants'

export interface ZoneFocusResult {
	newFocus: number
}

export class ZoneTracker {
	private zoneUsage = new Map<string, Record<string, number>>()
	private lastZone = new Map<string, string>()

	recordUse(agentId: string, zoneName: string): void {
		let usage = this.zoneUsage.get(agentId)
		if (!usage) { usage = {}; this.zoneUsage.set(agentId, usage) }
		usage[zoneName] = (usage[zoneName] || 0) + 1
	}

	getUsage(agentId: string): Record<string, number> | undefined {
		return this.zoneUsage.get(agentId)
	}

	getLastZone(agentId: string): string | undefined {
		return this.lastZone.get(agentId)
	}

	setLastZone(agentId: string, zoneName: string): void {
		this.lastZone.set(agentId, zoneName)
	}

	/** Compute focus change for a zone transition and update last zone. */
	updateZoneFocus(agentId: string, zoneName: string, currentFocus: number): ZoneFocusResult {
		const lastZone = this.lastZone.get(agentId)
		const newFocus = zoneName === lastZone
			? Math.min(FOCUS_MAX, currentFocus + FOCUS_GAIN_PER_USE)
			: 0
		this.lastZone.set(agentId, zoneName)
		return { newFocus }
	}
}
