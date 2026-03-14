import { describe, expect, it } from 'bun:test'
import { EventLog } from '../../src/mainview/domain/models/EventLog'

describe('EventLog', () => {
	it('adds entries', () => {
		const log = new EventLog()
		log.add('agent-1', 'did something', 'tool')
		expect(log.length).toBe(1)
		expect(log.getAll()[0]!.agent).toBe('agent-1')
		expect(log.getAll()[0]!.text).toBe('did something')
		expect(log.getAll()[0]!.type).toBe('tool')
	})

	it('enforces max size (ring buffer)', () => {
		const log = new EventLog(3)
		log.add('a', 'msg1', 'tool')
		log.add('b', 'msg2', 'message')
		log.add('c', 'msg3', 'task')
		log.add('d', 'msg4', 'error')

		expect(log.length).toBe(3)
		expect(log.getAll()[0]!.agent).toBe('b')
		expect(log.getAll()[2]!.agent).toBe('d')
	})

	it('records timestamps', () => {
		const log = new EventLog()
		const before = Date.now()
		log.add('agent', 'test', 'tool')
		const after = Date.now()

		const entry = log.getAll()[0]!
		expect(entry.time).toBeGreaterThanOrEqual(before)
		expect(entry.time).toBeLessThanOrEqual(after)
	})

	it('returns readonly array', () => {
		const log = new EventLog()
		log.add('a', 'test', 'tool')
		const entries = log.getAll()
		expect(entries.length).toBe(1)
	})
})
