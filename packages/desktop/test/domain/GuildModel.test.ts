import { describe, expect, it } from 'bun:test'
import { getGuildLevel, getGuildReputation } from '../../src/mainview/domain/models/GuildModel'

describe('GuildModel', () => {
	describe('getGuildLevel', () => {
		it('returns 1 for 0 XP', () => {
			expect(getGuildLevel(0)).toBe(1)
		})

		it('returns 1 for low XP', () => {
			expect(getGuildLevel(49)).toBe(1)
		})

		it('returns 2 for 50 XP', () => {
			expect(getGuildLevel(50)).toBe(2)
		})

		it('scales with square root', () => {
			// sqrt(200/50) = 2, floor + 1 = 3
			expect(getGuildLevel(200)).toBe(3)
			// sqrt(450/50) = 3, floor + 1 = 4
			expect(getGuildLevel(450)).toBe(4)
		})
	})

	describe('getGuildReputation', () => {
		it('returns Legendary Guild for level 12+', () => {
			expect(getGuildReputation(12)).toBe('Legendary Guild')
			expect(getGuildReputation(20)).toBe('Legendary Guild')
		})

		it('returns Master Guild for level 8-11', () => {
			expect(getGuildReputation(8)).toBe('Master Guild')
			expect(getGuildReputation(11)).toBe('Master Guild')
		})

		it('returns Journeyman Guild for level 5-7', () => {
			expect(getGuildReputation(5)).toBe('Journeyman Guild')
		})

		it('returns Apprentice Guild for level 3-4', () => {
			expect(getGuildReputation(3)).toBe('Apprentice Guild')
		})

		it('returns Unknown Guild for level 1-2', () => {
			expect(getGuildReputation(1)).toBe('Unknown Guild')
		})

		it('returns Unknown Guild for level 0', () => {
			expect(getGuildReputation(0)).toBe('Unknown Guild')
		})
	})
})
