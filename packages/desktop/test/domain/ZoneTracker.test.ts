import { describe, expect, it } from 'bun:test'
import { ZoneTracker } from '../../src/mainview/domain/services/ZoneTracker'

describe('ZoneTracker', () => {
	it('records zone usage', () => {
		const tracker = new ZoneTracker()
		tracker.recordUse('agent-1', 'library')
		tracker.recordUse('agent-1', 'library')
		tracker.recordUse('agent-1', 'workshop')

		const usage = tracker.getUsage('agent-1')
		expect(usage).toEqual({ library: 2, workshop: 1 })
	})

	it('returns undefined for unknown agents', () => {
		const tracker = new ZoneTracker()
		expect(tracker.getUsage('unknown')).toBeUndefined()
	})

	it('tracks last zone per agent', () => {
		const tracker = new ZoneTracker()
		tracker.setLastZone('agent-1', 'library')
		expect(tracker.getLastZone('agent-1')).toBe('library')

		tracker.setLastZone('agent-1', 'workshop')
		expect(tracker.getLastZone('agent-1')).toBe('workshop')
	})

	it('returns undefined for unknown agent last zone', () => {
		const tracker = new ZoneTracker()
		expect(tracker.getLastZone('unknown')).toBeUndefined()
	})

	it('tracks multiple agents independently', () => {
		const tracker = new ZoneTracker()
		tracker.recordUse('agent-1', 'library')
		tracker.recordUse('agent-2', 'workshop')

		expect(tracker.getUsage('agent-1')).toEqual({ library: 1 })
		expect(tracker.getUsage('agent-2')).toEqual({ workshop: 1 })
	})

	describe('updateZoneFocus', () => {
		it('increases focus when staying in the same zone', () => {
			const tracker = new ZoneTracker()
			tracker.setLastZone('agent-1', 'library')
			const result = tracker.updateZoneFocus('agent-1', 'library', 50)
			// FOCUS_GAIN_PER_USE = 10, so 50 + 10 = 60
			expect(result.newFocus).toBe(60)
		})

		it('caps focus at FOCUS_MAX (100)', () => {
			const tracker = new ZoneTracker()
			tracker.setLastZone('agent-1', 'library')
			const result = tracker.updateZoneFocus('agent-1', 'library', 95)
			expect(result.newFocus).toBe(100)
		})

		it('resets focus to 0 when switching zones', () => {
			const tracker = new ZoneTracker()
			tracker.setLastZone('agent-1', 'library')
			const result = tracker.updateZoneFocus('agent-1', 'workshop', 80)
			expect(result.newFocus).toBe(0)
		})

		it('resets focus to 0 on first zone use (no last zone)', () => {
			const tracker = new ZoneTracker()
			const result = tracker.updateZoneFocus('agent-1', 'library', 50)
			expect(result.newFocus).toBe(0)
		})

		it('updates lastZone after computing focus', () => {
			const tracker = new ZoneTracker()
			tracker.updateZoneFocus('agent-1', 'library', 0)
			expect(tracker.getLastZone('agent-1')).toBe('library')

			tracker.updateZoneFocus('agent-1', 'workshop', 0)
			expect(tracker.getLastZone('agent-1')).toBe('workshop')
		})
	})
})
