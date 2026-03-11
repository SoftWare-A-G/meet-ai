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
    const team = pm.spawn('room-1', 'test-room')
    expect(team).toBeDefined()
    expect(team.status).toBe('starting')
    expect(team.roomName).toBe('test-room')
    expect(team.sessionName).toBe('mai-room-1')
    expect(team.teamId).toBe('room-1')
    expect(pm.get('room-1')).toBe(team)
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

  test('spawn same room twice creates unique teamIds', () => {
    pm = new ProcessManager({ agentBinaries, dryRun: true })
    const team1 = pm.spawn('room-1', 'test-room', 'claude')
    const team2 = pm.spawn('room-1', 'test-room', 'codex')
    expect(team1.teamId).toBe('room-1')
    expect(team2.teamId).toBe('room-1-2')
    expect(team1.sessionName).toBe('mai-room-1')
    expect(team2.sessionName).toBe('mai-room-1-2')
    expect(pm.list().length).toBe(2)
    expect(pm.get('room-1')).toBe(team1)
    expect(pm.get('room-1-2')).toBe(team2)
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
    process.env.CODEX_HOME = '/tmp/custom-codex-home'
    process.env.MEET_AI_CODEX_STATE_DIR = '/tmp/custom-codex-state'
    const tmux = {
      newSession: (_name: string, _commandArgs: string[], env?: Record<string, string>) => {
        expect(env?.MEET_AI_RUNTIME).toBe('codex')
        expect(env?.MEET_AI_CODEX_PATH).toBe('echo')
        expect(env?.MEET_AI_CODEX_BOOTSTRAP_PROMPT).toContain('ROOM_ID: room-1')
        expect(env?.MEET_AI_AGENT_NAME).toBe('codex')
        expect(env?.MEET_AI_CODEX_RESUME_SESSION).toBeUndefined()
        expect(env?.CODEX_HOME).toBe('/tmp/custom-codex-home')
        expect(env?.MEET_AI_CODEX_STATE_DIR).toBe('/tmp/custom-codex-state')
        return { ok: true, output: '' }
      },
      killSession: () => ({ ok: true, output: '' }),
      listSessions: () => [],
    } as any

    pm = new ProcessManager({ agentBinaries, tmux })
    const team = pm.spawn('room-1', 'test-room', 'codex')

    expect(team.status).toBe('running')
    delete process.env.CODEX_HOME
    delete process.env.MEET_AI_CODEX_STATE_DIR
  })

  test('spawn returns error when coding agent binary is not configured', () => {
    pm = new ProcessManager({ agentBinaries: { claude: 'echo' }, dryRun: false })
    const team = pm.spawn('room-1', 'test-room', 'codex')
    expect(team.status).toBe('error')
    expect(team.lines[0]).toContain('No CLI binary configured for coding agent: codex')
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
        expect(env?.MEET_AI_CODEX_BOOTSTRAP_PROMPT).toContain('## Planning')
        expect(env?.MEET_AI_CODEX_BOOTSTRAP_PROMPT).toContain('If the user asks for a plan, or asks you to show/present/preview the plan before implementation, create or update the turn plan with the plan tool instead of replying with a plain-text plan.')
        expect(env?.MEET_AI_CODEX_BOOTSTRAP_PROMPT).toContain('Use update_plan for plan previews and revisions.')
        expect(env?.MEET_AI_CODEX_BOOTSTRAP_PROMPT).toContain('If you need clarifying input before making a plan, ask it through request_user_input instead of a plain-text message.')
        expect(env?.MEET_AI_CODEX_BOOTSTRAP_PROMPT).not.toContain('/meet-ai skill')
        expect(env?.MEET_AI_CODEX_BOOTSTRAP_PROMPT).not.toContain('Start agent-team mode')
        expect(env?.MEET_AI_CODEX_BOOTSTRAP_PROMPT).not.toContain('Send a brief welcome message to the room.')
        expect(env?.MEET_AI_CODEX_BOOTSTRAP_PROMPT).not.toContain('set_interaction_mode')
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
