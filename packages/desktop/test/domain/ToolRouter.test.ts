import { describe, expect, it } from 'bun:test'
import { routeToolToZone } from '../../src/mainview/domain/services/ToolRouter'

describe('ToolRouter', () => {
	it('routes Read to library', () => {
		expect(routeToolToZone('Read /path/to/file')).toBe('library')
	})

	it('routes Grep to library', () => {
		expect(routeToolToZone('Grep pattern')).toBe('library')
	})

	it('routes Glob to library', () => {
		expect(routeToolToZone('Glob **/*.ts')).toBe('library')
	})

	it('routes Edit to workshop', () => {
		expect(routeToolToZone('Edit /path/to/file')).toBe('workshop')
	})

	it('routes Write to workshop', () => {
		expect(routeToolToZone('Write /path/to/file')).toBe('workshop')
	})

	it('routes Bash to terminal', () => {
		expect(routeToolToZone('Bash ls -la')).toBe('terminal')
	})

	it('returns null for unknown tools', () => {
		expect(routeToolToZone('Agent research something')).toBeNull()
	})

	it('returns null for empty content', () => {
		expect(routeToolToZone('')).toBeNull()
	})
})
