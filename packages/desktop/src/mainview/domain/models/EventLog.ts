import type { EventLogEntry } from '../../types'
import { MAX_EVENT_LOG } from '../../constants'

export class EventLog {
	private entries: EventLogEntry[] = []
	private readonly maxSize: number

	constructor(maxSize = MAX_EVENT_LOG) {
		this.maxSize = maxSize
	}

	add(agentName: string, text: string, type: EventLogEntry['type']): void {
		this.entries.push({ time: Date.now(), agent: agentName, text, type })
		if (this.entries.length > this.maxSize) this.entries.shift()
	}

	getAll(): readonly EventLogEntry[] {
		return this.entries
	}

	get length(): number {
		return this.entries.length
	}
}
