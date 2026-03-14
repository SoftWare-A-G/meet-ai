import type { ZONES } from '../../constants'

export type ZoneName = keyof typeof ZONES

export function routeToolToZone(toolContent: string): ZoneName | null {
	const tool = (toolContent.match(/^(\w+)/)?.[1] ?? '').toLowerCase()

	if (['read', 'grep', 'glob'].some(t => tool.includes(t))) return 'library'
	if (['edit', 'write'].some(t => tool.includes(t))) return 'workshop'
	if (tool.includes('bash')) return 'terminal'

	return null
}
