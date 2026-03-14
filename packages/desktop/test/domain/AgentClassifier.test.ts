import { describe, expect, it } from 'bun:test'
import { getAgentSpecialty, getMoodLabel, getMoodEmoji } from '../../src/mainview/domain/services/AgentClassifier'

describe('AgentClassifier', () => {
	describe('getAgentSpecialty', () => {
		it('returns Wanderer for undefined usage', () => {
			expect(getAgentSpecialty(undefined)).toEqual({ name: 'Wanderer', icon: '\u{1F6B6}' })
		})

		it('returns Wanderer for low usage counts', () => {
			expect(getAgentSpecialty({ library: 2 })).toEqual({ name: 'Wanderer', icon: '\u{1F6B6}' })
		})

		it('returns Lorekeeper for library zone dominance', () => {
			expect(getAgentSpecialty({ library: 5, workshop: 1 })).toEqual({ name: 'Lorekeeper', icon: '\u{1F4D6}' })
		})

		it('returns Craftsman for workshop zone dominance', () => {
			expect(getAgentSpecialty({ workshop: 4 })).toEqual({ name: 'Craftsman', icon: '\u{1F527}' })
		})

		it('returns Operator for terminal zone dominance', () => {
			expect(getAgentSpecialty({ terminal: 10 })).toEqual({ name: 'Operator', icon: '\u{1F4BB}' })
		})

		it('returns Quartermaster for questBoard zone dominance', () => {
			expect(getAgentSpecialty({ questBoard: 5 })).toEqual({ name: 'Quartermaster', icon: '\u{1F4DC}' })
		})

		it('returns Wanderer for unknown zone with high count', () => {
			expect(getAgentSpecialty({ center: 10 })).toEqual({ name: 'Wanderer', icon: '\u{1F6B6}' })
		})
	})

	describe('getMoodLabel', () => {
		it('returns exhausted when fatigue > 80', () => {
			expect(getMoodLabel({ fatigue: 85, focus: 90, mood: 90 })).toBe('exhausted')
		})

		it('returns focused when focus > 70 and not exhausted', () => {
			expect(getMoodLabel({ fatigue: 20, focus: 80, mood: 50 })).toBe('focused')
		})

		it('returns stressed when fatigue > 50', () => {
			expect(getMoodLabel({ fatigue: 60, focus: 50, mood: 50 })).toBe('stressed')
		})

		it('returns stressed when mood < 30', () => {
			expect(getMoodLabel({ fatigue: 30, focus: 50, mood: 20 })).toBe('stressed')
		})

		it('returns calm otherwise', () => {
			expect(getMoodLabel({ fatigue: 30, focus: 50, mood: 50 })).toBe('calm')
		})
	})

	describe('getMoodEmoji', () => {
		it('maps known mood labels', () => {
			expect(getMoodEmoji('calm')).toBe('\u{1F60C}')
			expect(getMoodEmoji('focused')).toBe('\u{1F525}')
			expect(getMoodEmoji('stressed')).toBe('\u{1F612}')
			expect(getMoodEmoji('exhausted')).toBe('\u{1F634}')
		})

		it('defaults to calm emoji for unknown labels', () => {
			expect(getMoodEmoji('unknown')).toBe('\u{1F60C}')
		})
	})
})
