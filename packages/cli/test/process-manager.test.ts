import { describe, test, expect, afterEach } from 'bun:test'
import { ProcessManager } from '@meet-ai/cli/lib/process-manager'

describe('ProcessManager', () => {
  let pm: ProcessManager

  afterEach(() => {
    pm?.killAll()
  })

  test('spawn adds a process to the map', () => {
    pm = new ProcessManager({ claudePath: 'echo', dryRun: true })
    pm.spawn('room-1', 'test-room')
    const team = pm.get('room-1')
    expect(team).toBeDefined()
    expect(team!.status).toBe('starting')
    expect(team!.roomName).toBe('test-room')
    expect(team!.sessionName).toBe('mai-room-1')
  })

  test('list returns all tracked processes', () => {
    pm = new ProcessManager({ claudePath: 'echo', dryRun: true })
    pm.spawn('room-1', 'test-room-1')
    pm.spawn('room-2', 'test-room-2')
    expect(pm.list().length).toBe(2)
  })

  test('kill removes process from map', () => {
    pm = new ProcessManager({ claudePath: 'echo', dryRun: true })
    pm.spawn('room-1', 'test-room')
    pm.kill('room-1')
    expect(pm.get('room-1')).toBeUndefined()
  })

  test('killAll clears the map', () => {
    pm = new ProcessManager({ claudePath: 'echo', dryRun: true })
    pm.spawn('room-1', 'r1')
    pm.spawn('room-2', 'r2')
    pm.killAll()
    expect(pm.list().length).toBe(0)
  })

  test('addError creates error entry', () => {
    pm = new ProcessManager({ claudePath: 'echo', dryRun: true })
    pm.addError('err-1', 'bad-room', 'Something failed')
    const team = pm.get('err-1')
    expect(team).toBeDefined()
    expect(team!.status).toBe('error')
    expect(team!.lines).toContain('[error] Something failed')
  })

  test('spawned counter increments', () => {
    pm = new ProcessManager({ claudePath: 'echo', dryRun: true })
    expect(pm.spawned).toBe(0)
    pm.spawn('room-1', 'r1')
    expect(pm.spawned).toBe(1)
    pm.spawn('room-2', 'r2')
    expect(pm.spawned).toBe(2)
  })

  test('TeamProcess has sessionName field', () => {
    pm = new ProcessManager({ claudePath: 'echo', dryRun: true })
    const team = pm.spawn('abc-123', 'my-room')
    expect(team.sessionName).toBe('mai-abc-123')
  })

  test('onStatusChange not called in dryRun mode', () => {
    const changes: string[] = []
    pm = new ProcessManager({
      claudePath: 'echo',
      dryRun: true,
      onStatusChange: (roomId, status) => {
        changes.push(`${roomId}:${status}`)
      },
    })
    pm.spawn('room-1', 'test')
    // In dryRun, status stays 'starting' — no onStatusChange fires
    expect(changes).toEqual([])
  })
})
