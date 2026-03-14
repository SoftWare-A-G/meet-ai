import { GUILD_THRESHOLDS } from '../../constants'

export function getGuildLevel(totalXP: number): number {
	return Math.floor(Math.sqrt(totalXP / 50)) + 1
}

export function getGuildReputation(guildLevel: number): string {
	for (const t of GUILD_THRESHOLDS) {
		if (guildLevel >= t.level) return t.name
	}
	return 'Unknown Guild'
}
