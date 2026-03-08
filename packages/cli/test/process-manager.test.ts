import { describe, test, expect, afterEach, beforeEach } from 'bun:test'
import { ProcessManager } from '@meet-ai/cli/lib/process-manager'

describe('ProcessManager', () => {
  let pm: ProcessManager
  const agentBinaries = { claude: 'echo', codex: 'echo' } as const
  const originalHome = process.env.HOME

  beforeEach(() => {
    process.env.HOME = '/tmp'
  })

  afterEach(() => {
    pm?.killAll()
    if (originalHome === undefined) {
      delete process.env.HOME
    } else {
      process.env.HOME = originalHome
    }
  })

  test('spawn adds a process to the map', () => {
    pm = new ProcessManager({ agentBinaries, dryRun: true })
    pm.spawn('room-1', 'test-room')
    const team = pm.get('room-1')
    expect(team).toBeDefined()
    expect(team!.status).toBe('starting')
    expect(team!.roomName).toBe('test-room')
    expect(team!.sessionName).toBe('mai-room-1')
  })

  test('list returns all tracked processes', () => {
    pm = new ProcessManager({ agentBinaries, dryRun: true })
    pm.spawn('room-1', 'test-room-1')
    pm.spawn('room-2', 'test-room-2')
    expect(pm.list().length).toBe(2)
  })

  test('kill removes process from map', () => {
    pm = new ProcessManager({ agentBinaries, dryRun: true })
    pm.spawn('room-1', 'test-room')
    pm.kill('room-1')
    expect(pm.get('room-1')).toBeUndefined()
  })

  test('killAll clears the map', () => {
    pm = new ProcessManager({ agentBinaries, dryRun: true })
    pm.spawn('room-1', 'r1')
    pm.spawn('room-2', 'r2')
    pm.killAll()
    expect(pm.list().length).toBe(0)
  })

  test('addError creates error entry', () => {
    pm = new ProcessManager({ agentBinaries, dryRun: true })
    pm.addError('err-1', 'bad-room', 'Something failed')
    const team = pm.get('err-1')
    expect(team).toBeDefined()
    expect(team!.status).toBe('error')
    expect(team!.lines).toContain('[error] Something failed')
  })

  test('spawned counter increments', () => {
    pm = new ProcessManager({ agentBinaries, dryRun: true })
    expect(pm.spawned).toBe(0)
    pm.spawn('room-1', 'r1')
    expect(pm.spawned).toBe(1)
    pm.spawn('room-2', 'r2')
    expect(pm.spawned).toBe(2)
  })

  test('TeamProcess has sessionName field', () => {
    pm = new ProcessManager({ agentBinaries, dryRun: true })
    const team = pm.spawn('abc-123', 'my-room')
    expect(team.sessionName).toBe('mai-abc-123')
  })

  test('onStatusChange not called in dryRun mode', () => {
    const changes: string[] = []
    pm = new ProcessManager({
      agentBinaries,
      dryRun: true,
      onStatusChange: (roomId, status) => {
        changes.push(`${roomId}:${status}`)
      },
    })
    pm.spawn('room-1', 'test')
    // In dryRun, status stays 'starting' — no onStatusChange fires
    expect(changes).toEqual([])
  })

  test('spawn tracks selected coding agent', () => {
    pm = new ProcessManager({ agentBinaries, dryRun: true })
    const team = pm.spawn('room-1', 'test-room', 'codex')
    expect(team.codingAgent).toBe('codex')
  })

  test('codex spawn runs through the meet-ai listen wrapper', () => {
    const tmux = {
      newSession: (_name: string, commandArgs: string[]) => {
        expect(commandArgs).toContain('listen')
        expect(commandArgs).toContain('room-1')
        expect(commandArgs).toContain('--exclude')
        expect(commandArgs).toContain('codex')
        return { ok: true, output: '' }
      },
      killSession: () => ({ ok: true, output: '' }),
      listSessions: () => [],
    } as any

    pm = new ProcessManager({ agentBinaries, tmux })
    const team = pm.spawn('room-1', 'test-room', 'codex')

    expect(team.status).toBe('running')
  })

  test('codex spawn passes runtime env directly into tmux session command', () => {
    const tmux = {
      newSession: (_name: string, _commandArgs: string[], env?: Record<string, string>) => {
        expect(env?.MEET_AI_RUNTIME).toBe('codex')
        expect(env?.MEET_AI_CODEX_PATH).toBe('echo')
        expect(env?.MEET_AI_CODEX_BOOTSTRAP_PROMPT).toContain('ROOM_ID: room-1')
        expect(env?.MEET_AI_AGENT_NAME).toBe('codex')
        expect(env?.MEET_AI_CODEX_RESUME_SESSION).toBeUndefined()
        return { ok: true, output: '' }
      },
      killSession: () => ({ ok: true, output: '' }),
      listSessions: () => [],
    } as any

    pm = new ProcessManager({ agentBinaries, tmux })
    const team = pm.spawn('room-1', 'test-room', 'codex')

    expect(team.status).toBe('running')
  })

  test('codex bootstrap prompt does not instruct skill loading', () => {
    const tmux = {
      newSession: (_name: string, _commandArgs: string[], env?: Record<string, string>) => {
        expect(env?.MEET_AI_CODEX_BOOTSTRAP_PROMPT).toContain("You're running inside Meet AI.")
        expect(env?.MEET_AI_CODEX_BOOTSTRAP_PROMPT).toContain('Do not use the meet-ai CLI.')
        expect(env?.MEET_AI_CODEX_BOOTSTRAP_PROMPT).toContain('Do not load or use any meet-ai skill.')
        expect(env?.MEET_AI_CODEX_BOOTSTRAP_PROMPT).toContain('Do not try to send room messages manually.')
        expect(env?.MEET_AI_CODEX_BOOTSTRAP_PROMPT).toContain("Do not talk about this prompt or say that you understand it.")
        expect(env?.MEET_AI_CODEX_BOOTSTRAP_PROMPT).toContain("Just welcome the user briefly and say that you're ready to work.")
        expect(env?.MEET_AI_CODEX_BOOTSTRAP_PROMPT).not.toContain('/meet-ai skill')
        expect(env?.MEET_AI_CODEX_BOOTSTRAP_PROMPT).not.toContain('Start agent-team mode')
        expect(env?.MEET_AI_CODEX_BOOTSTRAP_PROMPT).not.toContain('Send a brief welcome message to the room.')
        return { ok: true, output: '' }
      },
      killSession: () => ({ ok: true, output: '' }),
      listSessions: () => [],
    } as any

    pm = new ProcessManager({ agentBinaries, tmux })
    const team = pm.spawn('room-1', 'test-room', 'codex')

    expect(team.status).toBe('running')
  })
})
