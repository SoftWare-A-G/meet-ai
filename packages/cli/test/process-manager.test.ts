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

  test('claude spawn appends Meet AI command guidance as a durable system prompt', () => {
    const tmux = {
      newSession: (_name: string, commandArgs: string[]) => {
        const systemPromptIndex = commandArgs.indexOf('--append-system-prompt')
        expect(systemPromptIndex).toBeGreaterThan(-1)
        const systemPrompt = commandArgs[systemPromptIndex + 1]
        const prompt = commandArgs.at(-1)
        expect(systemPrompt).toContain("You're running inside Meet AI.")
        expect(systemPrompt).toContain('ROOM_ID: room-1')
        expect(systemPrompt).toContain('Relay every outbound message (SendMessage/broadcast) through the CLI:')
        expect(systemPrompt).toContain('meet-ai send-message')
        expect(systemPrompt).toContain('canvas tools')
        expect(systemPrompt).toContain('add_canvas_note')
        expect(systemPrompt).not.toContain('/meet-ai skill')
        expect(prompt).toContain('ROOM_ID: room-1')
        expect(prompt).toContain('You are a team lead. IMMEDIATELY perform these steps:')
        return { ok: true, output: '' }
      },
      killSession: () => ({ ok: true, output: '' }),
      listSessions: () => [],
    } as any

    pm = new ProcessManager({ agentBinaries, tmux })
    const team = pm.spawn('room-1', 'test-room', 'claude')

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
        expect(env?.MEET_AI_CODEX_BOOTSTRAP_PROMPT).toContain('If a user input starts with a username mention and that username is not yours, do not answer it.')
        expect(env?.MEET_AI_CODEX_BOOTSTRAP_PROMPT).toContain('Do not reply with "standing by" or any other acknowledgment to messages addressed to someone else.')
        expect(env?.MEET_AI_CODEX_BOOTSTRAP_PROMPT).toContain("Just welcome the user briefly and say that you're ready to work.")
        expect(env?.MEET_AI_CODEX_BOOTSTRAP_PROMPT).toContain('## Planning')
        expect(env?.MEET_AI_CODEX_BOOTSTRAP_PROMPT).toContain('Use update_plan when the user explicitly asks for a plan, plan preview, or execution design, or when the task is large, risky, or ambiguous enough that implementation without a plan would be sloppy.')
        expect(env?.MEET_AI_CODEX_BOOTSTRAP_PROMPT).toContain('Do not create a plan for small, clear work such as changelog edits, copy tweaks, docs updates, config nits, or fixes that are only a few lines.')
        expect(env?.MEET_AI_CODEX_BOOTSTRAP_PROMPT).toContain('If the work is small and clear, implement it directly.')
        expect(env?.MEET_AI_CODEX_BOOTSTRAP_PROMPT).toContain('Do not respond with a plain-text TODO list when the user asked for a plan, a plan preview, or an execution design before coding.')
        expect(env?.MEET_AI_CODEX_BOOTSTRAP_PROMPT).toContain('## Plan Structure')
        expect(env?.MEET_AI_CODEX_BOOTSTRAP_PROMPT).toContain('### Tasks')
        expect(env?.MEET_AI_CODEX_BOOTSTRAP_PROMPT).toContain('Include the actual test code and the actual implementation code in the plan, not just a description of the change.')
        expect(env?.MEET_AI_CODEX_BOOTSTRAP_PROMPT).toContain('## Quality Bar')
        expect(env?.MEET_AI_CODEX_BOOTSTRAP_PROMPT).toContain('Exact file paths are required.')
        expect(env?.MEET_AI_CODEX_BOOTSTRAP_PROMPT).toContain('Exact test commands are required.')
        expect(env?.MEET_AI_CODEX_BOOTSTRAP_PROMPT).toContain('Explicit commit checkpoints after each passing test block are required.')
        expect(env?.MEET_AI_CODEX_BOOTSTRAP_PROMPT).toContain('If TDD is not practical, explicitly say why and define the exact alternative verification path.')
        expect(env?.MEET_AI_CODEX_BOOTSTRAP_PROMPT).toContain('## Execution Rules')
        expect(env?.MEET_AI_CODEX_BOOTSTRAP_PROMPT).toContain('Do not wait for plan approval unless you created a plan because the user asked for one or the task genuinely required one.')
        expect(env?.MEET_AI_CODEX_BOOTSTRAP_PROMPT).toContain('If clarification is needed before planning or implementation, use request_user_input.')
        expect(env?.MEET_AI_CODEX_BOOTSTRAP_PROMPT).toContain('## Canvas')
        expect(env?.MEET_AI_CODEX_BOOTSTRAP_PROMPT).toContain('If the user asks for canvas work, use the built-in canvas tools instead of describing edits without acting.')
        expect(env?.MEET_AI_CODEX_BOOTSTRAP_PROMPT).toContain('Use list_canvas_shape_types before creating raw tldraw shapes, and prefer add_canvas_note for short welcome notes or labels.')
        expect(env?.MEET_AI_CODEX_BOOTSTRAP_PROMPT).not.toContain('Before implementing, produce an execution-grade plan using update_plan.')
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
