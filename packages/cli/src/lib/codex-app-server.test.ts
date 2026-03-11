import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test'
import { PassThrough } from 'node:stream'
import { CodexAppServerBridge, type CodexAppServerEvent } from './codex-app-server'
import type { ChildProcessWithoutNullStreams, SpawnOptionsWithoutStdio } from 'node:child_process'
import type { ToolRequestUserInputParams } from '@meet-ai/cli/generated/codex-app-server/v2/ToolRequestUserInputParams'

type RecordedRequest = {
  method?: string
  id?: string | number
  params?: any
  result?: any
}

function createFakeAppServer(options?: {
  resumeTurns?: { id: string; status: string }[]
  steerError?: string
}) {
  const stdin = new PassThrough()
  const stdout = new PassThrough()
  const stderr = new PassThrough()
  const requests: RecordedRequest[] = []

  let buffered = ''
  stdin.on('data', chunk => {
    buffered += chunk.toString()
    let newlineIndex = buffered.indexOf('\n')
    while (newlineIndex >= 0) {
      const line = buffered.slice(0, newlineIndex).trim()
      buffered = buffered.slice(newlineIndex + 1)
      newlineIndex = buffered.indexOf('\n')
      if (!line) continue

      const request = JSON.parse(line) as RecordedRequest
      requests.push(request)

      switch (request.method) {
        case 'initialize': {
          stdout.write(
            `${JSON.stringify({ id: request.id, result: { userAgent: 'codex-test' } })}\n`
          )
          break
        }
        case 'thread/resume': {
          stdout.write(
            `${JSON.stringify({
              id: request.id,
              result: {
                thread: {
                  turns: options?.resumeTurns ?? [],
                },
              },
            })}\n`
          )
          break
        }
        case 'turn/start': {
          stdout.write(
            `${JSON.stringify({ id: request.id, result: { turn: { id: 'turn-started' } } })}\n`
          )
          break
        }
        case 'turn/steer': {
          if (options?.steerError) {
            stdout.write(
              `${JSON.stringify({ id: request.id, error: { message: options.steerError } })}\n`
            )
          } else {
            stdout.write(
              `${JSON.stringify({ id: request.id, result: { turnId: 'turn-steered' } })}\n`
            )
          }
          break
        }
      }
    }
  })

  const child = {
    stdin,
    stdout,
    stderr,
    kill: mock(() => true),
    on: mock((_event: string, _handler: (...args: any[]) => void) => child),
  } as unknown as ChildProcessWithoutNullStreams

  const spawnFn = (_command: string, _args: string[], _spawnOptions: SpawnOptionsWithoutStdio) =>
    child

  return { child, spawnFn, requests }
}

function emitNotification(
  child: ChildProcessWithoutNullStreams,
  notification: Record<string, unknown>
): void {
  child.stdout.push(`${JSON.stringify(notification)}\n`)
}

describe('CodexAppServerBridge', () => {
  let logSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    logSpy = spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    logSpy.mockRestore()
  })

  it('starts a new turn when the resumed thread is idle', async () => {
    const fake = createFakeAppServer()
    const bridge = new CodexAppServerBridge({
      threadId: 'thread-1',
      spawnFn: fake.spawnFn,
    })

    const result = await bridge.injectText({
      sender: 'alice',
      content: 'hello from web',
      timestamp: '2026-03-08T00:00:00.000Z',
    })

    expect(result).toEqual({ mode: 'start', threadId: 'thread-1', turnId: 'turn-started' })
    expect(fake.requests.map(request => request.method)).toEqual([
      'initialize',
      'initialized',
      'thread/resume',
      'turn/start',
    ])
    expect(fake.requests[0]?.params?.capabilities).toEqual({ experimentalApi: false })
    expect(fake.requests[2]?.params).toEqual({
      threadId: 'thread-1',
      persistExtendedHistory: false,
    })
    expect(fake.requests[3]?.params?.input?.[0]?.text).toContain('hello from web')
    expect(fake.requests[3]?.params?.input?.[0]?.text).toContain('alice')
  })

  it('launches codex app-server with the multi_agent feature enabled', async () => {
    let spawnArgs: string[] = []
    const fake = createFakeAppServer()
    const bridge = new CodexAppServerBridge({
      threadId: 'thread-1',
      spawnFn: (command, args, options) => {
        spawnArgs = [command, ...args]
        return fake.spawnFn(command, args, options)
      },
    })

    await bridge.injectText({
      sender: 'alice',
      content: 'hello from web',
    })

    expect(spawnArgs.slice(1)).toEqual([
      'app-server',
      '--enable',
      'multi_agent',
      '--enable',
      'memories',
      '--enable',
      'realtime_conversation',
      '-c',
      'sandbox_mode="workspace-write"',
      '-c',
      'ask_for_approval="never"',
      '-c',
      'sandbox_workspace_write.network_access=true',
      '-c',
      'web_search="live"',
      '--listen',
      'stdio://',
    ])
  })

  it('opts into experimental app-server fields when enabled', async () => {
    const fake = createFakeAppServer()
    const bridge = new CodexAppServerBridge({
      threadId: 'thread-1',
      experimentalApi: true,
      spawnFn: fake.spawnFn,
    })

    await bridge.injectText({
      sender: 'alice',
      content: 'hello from web',
    })

    expect(fake.requests[0]?.params?.capabilities).toEqual({ experimentalApi: true })
    expect(fake.requests[2]?.params).toEqual({
      threadId: 'thread-1',
      persistExtendedHistory: true,
    })
  })

  it('steers the active turn discovered during resume', async () => {
    const fake = createFakeAppServer({
      resumeTurns: [{ id: 'turn-active', status: 'inProgress' }],
    })
    const bridge = new CodexAppServerBridge({
      threadId: 'thread-1',
      spawnFn: fake.spawnFn,
    })

    const result = await bridge.injectText({
      sender: 'alice',
      content: 'follow-up',
    })

    expect(result).toEqual({ mode: 'steer', threadId: 'thread-1', turnId: 'turn-steered' })
    expect(fake.requests[3]).toMatchObject({
      method: 'turn/steer',
      params: { expectedTurnId: 'turn-active' },
    })
  })

  it('falls back to starting a new turn when steer precondition fails', async () => {
    const fake = createFakeAppServer({
      resumeTurns: [{ id: 'turn-stale', status: 'inProgress' }],
      steerError: 'expectedTurnId does not match currently active turn',
    })
    const bridge = new CodexAppServerBridge({
      threadId: 'thread-1',
      spawnFn: fake.spawnFn,
    })

    const result = await bridge.injectText({
      sender: 'alice',
      content: 'recover',
    })

    expect(result).toEqual({ mode: 'start', threadId: 'thread-1', turnId: 'turn-started' })
    expect(fake.requests.map(request => request.method)).toEqual([
      'initialize',
      'initialized',
      'thread/resume',
      'turn/steer',
      'turn/start',
    ])
  })

  it('emits agent message and turn completion events from app-server notifications', async () => {
    const fake = createFakeAppServer()
    const events: CodexAppServerEvent[] = []
    const bridge = new CodexAppServerBridge({
      threadId: 'thread-1',
      spawnFn: fake.spawnFn,
    })

    bridge.setEventHandler(event => {
      events.push(event)
    })

    await bridge.injectText({
      sender: 'alice',
      content: 'hello from web',
    })

    emitNotification(fake.child, {
      method: 'item/agentMessage/delta',
      params: {
        itemId: 'item-1',
        turnId: 'turn-started',
        threadId: 'thread-1',
        delta: 'Hello ',
      },
    })
    emitNotification(fake.child, {
      method: 'item/completed',
      params: {
        threadId: 'thread-1',
        turnId: 'turn-started',
        item: {
          id: 'item-1',
          type: 'agentMessage',
          text: 'Hello world',
          phase: null,
        },
      },
    })
    emitNotification(fake.child, {
      method: 'turn/completed',
      params: {
        threadId: 'thread-1',
        turn: { id: 'turn-started' },
      },
    })

    await new Promise(resolve => setTimeout(resolve, 0))

    expect(events).toEqual([
      {
        type: 'agent_message_delta',
        itemId: 'item-1',
        turnId: 'turn-started',
        text: 'Hello ',
      },
      {
        type: 'agent_message_completed',
        itemId: 'item-1',
        turnId: 'turn-started',
        text: 'Hello world',
      },
      {
        type: 'turn_completed',
        turnId: 'turn-started',
      },
    ])
  })

  it('emits activity log events for command and turn diff notifications', async () => {
    const fake = createFakeAppServer()
    const events: CodexAppServerEvent[] = []
    const bridge = new CodexAppServerBridge({
      threadId: 'thread-1',
      spawnFn: fake.spawnFn,
    })

    bridge.setEventHandler(event => {
      events.push(event)
    })

    await bridge.injectText({
      sender: 'alice',
      content: 'hello from web',
    })

    emitNotification(fake.child, {
      method: 'item/started',
      params: {
        threadId: 'thread-1',
        turnId: 'turn-started',
        item: {
          type: 'commandExecution',
          id: 'cmd-1',
          command: 'bun test packages/cli/src/lib/codex-app-server.test.ts',
          cwd: '/repo',
          processId: null,
          status: 'inProgress',
          commandActions: [],
          aggregatedOutput: null,
          exitCode: null,
          durationMs: null,
        },
      },
    })

    emitNotification(fake.child, {
      method: 'turn/diff/updated',
      params: {
        threadId: 'thread-1',
        turnId: 'turn-started',
        diff: [
          'diff --git a/src/lib/codex-app-server.ts b/src/lib/codex-app-server.ts',
          '--- a/src/lib/codex-app-server.ts',
          '+++ b/src/lib/codex-app-server.ts',
          '@@ -1 +1 @@',
          'diff --git a/src/lib/new-file.ts b/src/lib/new-file.ts',
          '--- /dev/null',
          '+++ b/src/lib/new-file.ts',
          '@@ -0,0 +1,1 @@',
          '+export const created = true',
        ].join('\n'),
      },
    })
    emitNotification(fake.child, {
      method: 'turn/diff/updated',
      params: {
        threadId: 'thread-1',
        turnId: 'turn-started',
        diff: [
          'diff --git a/src/lib/codex-app-server.ts b/src/lib/codex-app-server.ts',
          '--- a/src/lib/codex-app-server.ts',
          '+++ b/src/lib/codex-app-server.ts',
          '@@ -1 +1 @@',
          'diff --git a/src/lib/new-file.ts b/src/lib/new-file.ts',
          '--- /dev/null',
          '+++ b/src/lib/new-file.ts',
          '@@ -0,0 +1,1 @@',
          '+export const created = true',
        ].join('\n'),
      },
    })

    expect(events).toContainEqual({
      type: 'activity_log',
      itemId: 'cmd-1',
      turnId: 'turn-started',
      summary: 'Bash: bun test packages/cli/src/lib/codex-app-server.test.ts',
    })
    expect(events).toContainEqual({
      type: 'activity_log',
      itemId: null,
      turnId: 'turn-started',
      summary:
        '[diff:src/lib/codex-app-server.ts]\n--- a/src/lib/codex-app-server.ts\n+++ b/src/lib/codex-app-server.ts\n@@ -1,1 +1,1 @@\n',
    })
    expect(events).toContainEqual({
      type: 'activity_log',
      itemId: null,
      turnId: 'turn-started',
      summary:
        '[diff:src/lib/new-file.ts]\n--- /dev/null\n+++ b/src/lib/new-file.ts\n@@ -0,0 +1,1 @@\n+export const created = true',
    })
    expect(
      events.filter(
        event =>
          event.type === 'activity_log' && event.turnId === 'turn-started' && event.itemId === null
      )
    ).toHaveLength(2)
  })

  it('ignores agent message notifications from other threads', async () => {
    const fake = createFakeAppServer()
    const events: CodexAppServerEvent[] = []
    const bridge = new CodexAppServerBridge({
      threadId: 'thread-1',
      spawnFn: fake.spawnFn,
    })

    bridge.setEventHandler(event => {
      events.push(event)
    })

    await bridge.injectText({
      sender: 'alice',
      content: 'hello from web',
    })

    emitNotification(fake.child, {
      method: 'item/agentMessage/delta',
      params: {
        itemId: 'item-foreign',
        turnId: 'turn-foreign',
        threadId: 'thread-2',
        delta: 'foreign delta',
      },
    })
    emitNotification(fake.child, {
      method: 'item/completed',
      params: {
        threadId: 'thread-2',
        turnId: 'turn-foreign',
        item: {
          id: 'item-foreign',
          type: 'agentMessage',
          text: 'foreign completed',
          phase: null,
        },
      },
    })
    emitNotification(fake.child, {
      method: 'item/agentMessage/delta',
      params: {
        itemId: 'item-1',
        turnId: 'turn-started',
        threadId: 'thread-1',
        delta: 'local delta',
      },
    })
    emitNotification(fake.child, {
      method: 'item/completed',
      params: {
        threadId: 'thread-1',
        turnId: 'turn-started',
        item: {
          id: 'item-1',
          type: 'agentMessage',
          text: 'local completed',
          phase: null,
        },
      },
    })

    await new Promise(resolve => setTimeout(resolve, 0))

    expect(events).toEqual([
      {
        type: 'agent_message_delta',
        itemId: 'item-1',
        turnId: 'turn-started',
        text: 'local delta',
      },
      {
        type: 'agent_message_completed',
        itemId: 'item-1',
        turnId: 'turn-started',
        text: 'local completed',
      },
    ])
  })

  it('routes child stderr lines through evlog output', async () => {
    const fake = createFakeAppServer()
    const bridge = new CodexAppServerBridge({
      threadId: 'thread-1',
      spawnFn: fake.spawnFn,
    })

    await bridge.injectText({
      sender: 'alice',
      content: 'hello from web',
    })

    fake.child.stderr.push('app-server warning\n')
    await new Promise(resolve => setTimeout(resolve, 0))

    const output = logSpy.mock.calls
      .flat()
      .map((value: unknown) => String(value))
      .join('\n')
    expect(output).toContain('process.stderr')
    expect(output).toContain('app-server warning')
  })

  it('logs additional app-server notification types and non-message items', async () => {
    const fake = createFakeAppServer()
    const bridge = new CodexAppServerBridge({
      threadId: 'thread-1',
      spawnFn: fake.spawnFn,
    })

    await bridge.injectText({
      sender: 'alice',
      content: 'hello from web',
    })

    emitNotification(fake.child, {
      method: 'item/started',
      params: {
        threadId: 'thread-1',
        turnId: 'turn-started',
        item: {
          id: 'cmd-1',
          type: 'commandExecution',
          command: 'bun test',
          cwd: '/tmp/demo',
          processId: 'pty-1',
          status: 'inProgress',
          commandActions: [],
          aggregatedOutput: null,
          exitCode: null,
          durationMs: null,
        },
      },
    })
    emitNotification(fake.child, {
      method: 'item/commandExecution/outputDelta',
      params: {
        threadId: 'thread-1',
        turnId: 'turn-started',
        itemId: 'cmd-1',
        delta: 'running tests',
      },
    })
    emitNotification(fake.child, {
      method: 'turn/plan/updated',
      params: {
        threadId: 'thread-1',
        turnId: 'turn-started',
        explanation: 'Working through the implementation',
        plan: [{ step: 'Add logs', status: 'in_progress' }],
      },
    })
    emitNotification(fake.child, {
      method: 'item/reasoningSummaryText/delta',
      params: {
        threadId: 'thread-1',
        turnId: 'turn-started',
        itemId: 'reason-1',
        summaryIndex: 0,
        delta: 'Investigating runtime events',
      },
    })
    emitNotification(fake.child, {
      method: 'terminal/interaction',
      params: {
        threadId: 'thread-1',
        turnId: 'turn-started',
        itemId: 'cmd-1',
        processId: 'pty-1',
        stdin: 'y\n',
      },
    })
    emitNotification(fake.child, {
      method: 'model/rerouted',
      params: {
        threadId: 'thread-1',
        turnId: 'turn-started',
        fromModel: 'gpt-5',
        toModel: 'gpt-5-mini',
        reason: 'rate_limited',
      },
    })
    emitNotification(fake.child, {
      method: 'error',
      params: {
        threadId: 'thread-1',
        turnId: 'turn-started',
        willRetry: true,
        error: {
          message: 'temporary failure',
        },
      },
    })
    emitNotification(fake.child, {
      method: 'item/completed',
      params: {
        threadId: 'thread-1',
        turnId: 'turn-started',
        item: {
          id: 'cmd-1',
          type: 'commandExecution',
          command: 'bun test',
          cwd: '/tmp/demo',
          processId: 'pty-1',
          status: 'completed',
          commandActions: [],
          aggregatedOutput: '1 pass',
          exitCode: 0,
          durationMs: 42,
        },
      },
    })

    await new Promise(resolve => setTimeout(resolve, 0))

    const output = logSpy.mock.calls
      .flat()
      .map((value: unknown) => String(value))
      .join('\n')
    expect(output).toContain('notification.received')
    expect(output).toContain('item.started')
    expect(output).toContain('item.command_execution_output_delta')
    expect(output).toContain('turn.plan_updated')
    expect(output).toContain('item.reasoning_summary_delta')
    expect(output).toContain('terminal.interaction')
    expect(output).toContain('model.rerouted')
    expect(output).toContain('turn.error')
    expect(output).toContain('item.completed')
    expect(output).toContain('bun test')
  })

  it('routes request_user_input server requests through the registered handler', async () => {
    const fake = createFakeAppServer()
    const requestUserInputHandler = mock(async (_params: ToolRequestUserInputParams) => ({
      answers: {
        'question-1': { answers: ['Red'] },
      },
    }))
    const bridge = new CodexAppServerBridge({
      threadId: 'thread-1',
      spawnFn: fake.spawnFn,
      requestUserInputHandler,
    })

    await bridge.injectText({
      sender: 'alice',
      content: 'hello from web',
    })

    emitNotification(fake.child, {
      method: 'item/tool/requestUserInput',
      id: 'request-user-input-1',
      params: {
        threadId: 'thread-1',
        turnId: 'turn-started',
        itemId: 'item-question-1',
        questions: [
          {
            id: 'question-1',
            header: 'Color',
            question: 'Pick a color',
            isOther: false,
            isSecret: false,
            options: [{ label: 'Red', description: 'Warm' }],
          },
        ],
      },
    })

    await new Promise(resolve => setTimeout(resolve, 0))

    expect(requestUserInputHandler).toHaveBeenCalledTimes(1)
    expect(fake.requests.at(-1)).toEqual({
      id: 'request-user-input-1',
      result: {
        answers: {
          'question-1': { answers: ['Red'] },
        },
      },
    })
  })

  it('emits turn plan update events for the active thread', async () => {
    const fake = createFakeAppServer()
    const events: CodexAppServerEvent[] = []
    const bridge = new CodexAppServerBridge({
      threadId: 'thread-1',
      spawnFn: fake.spawnFn,
    })

    bridge.setEventHandler(event => {
      events.push(event)
    })

    await bridge.injectText({
      sender: 'alice',
      content: 'hello from web',
    })

    emitNotification(fake.child, {
      method: 'turn/plan/updated',
      params: {
        threadId: 'thread-1',
        turnId: 'turn-started',
        explanation: 'Ship the plan UI',
        plan: [
          { step: 'Emit bridge event', status: 'inProgress' },
          { step: 'Create review card', status: 'pending' },
        ],
      },
    })
    emitNotification(fake.child, {
      method: 'turn/planUpdated',
      params: {
        threadId: 'thread-2',
        turnId: 'turn-foreign',
        explanation: 'Ignore this thread',
        plan: [{ step: 'No-op', status: 'pending' }],
      },
    })

    await new Promise(resolve => setTimeout(resolve, 0))

    expect(events).toContainEqual({
      type: 'turn_plan_updated',
      threadId: 'thread-1',
      turnId: 'turn-started',
      explanation: 'Ship the plan UI',
      plan: [
        { step: 'Emit bridge event', status: 'inProgress' },
        { step: 'Create review card', status: 'pending' },
      ],
    })
    expect(events).not.toContainEqual(
      expect.objectContaining({
        type: 'turn_plan_updated',
        threadId: 'thread-2',
      }),
    )
  })

  it('accepts generated notification method names for thread metadata updates', async () => {
    const fake = createFakeAppServer()
    const logSpy = spyOn(console, 'log').mockImplementation(() => {})
    const bridge = new CodexAppServerBridge({
      threadId: 'thread-1',
      spawnFn: fake.spawnFn,
    })

    await bridge.start()

    emitNotification(fake.child, {
      method: 'thread/status/changed',
      params: {
        threadId: 'thread-1',
        status: 'running',
      },
    })
    emitNotification(fake.child, {
      method: 'thread/name/updated',
      params: {
        threadId: 'thread-1',
        threadName: 'Generated Method Name',
      },
    })
    emitNotification(fake.child, {
      method: 'thread/tokenUsage/updated',
      params: {
        threadId: 'thread-1',
        turnId: 'turn-1',
        tokenUsage: {
          inputTokens: 10,
          outputTokens: 20,
          totalTokens: 30,
        },
      },
    })
    await new Promise(resolve => setTimeout(resolve, 0))

    const output = logSpy.mock.calls
      .flat()
      .map((value: unknown) => String(value))
      .join('\n')
    expect(output).toContain('thread.status_changed')
    expect(output).toContain('thread.name_updated')
    expect(output).toContain('thread.token_usage_updated')
  })
})
