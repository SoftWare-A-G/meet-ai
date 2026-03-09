import { describe, expect, it, mock } from 'bun:test'
import { PassThrough } from 'node:stream'
import type { ChildProcessWithoutNullStreams, SpawnOptionsWithoutStdio } from 'node:child_process'
import { CodexAppServerBridge, type CodexAppServerEvent } from './codex-app-server'

type RecordedRequest = {
  method: string
  id?: string | number
  params?: any
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
  stdin.on('data', (chunk) => {
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
          stdout.write(`${JSON.stringify({ id: request.id, result: { userAgent: 'codex-test' } })}\n`)
          break
        }
        case 'thread/resume': {
          stdout.write(`${JSON.stringify({
            id: request.id,
            result: {
              thread: {
                turns: options?.resumeTurns ?? [],
              },
            },
          })}\n`)
          break
        }
        case 'turn/start': {
          stdout.write(`${JSON.stringify({ id: request.id, result: { turn: { id: 'turn-started' } } })}\n`)
          break
        }
        case 'turn/steer': {
          if (options?.steerError) {
            stdout.write(`${JSON.stringify({ id: request.id, error: { message: options.steerError } })}\n`)
          } else {
            stdout.write(`${JSON.stringify({ id: request.id, result: { turnId: 'turn-steered' } })}\n`)
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

  const spawnFn = (
    _command: string,
    _args: string[],
    _spawnOptions: SpawnOptionsWithoutStdio,
  ) => child

  return { child, spawnFn, requests }
}

function emitNotification(
  child: ChildProcessWithoutNullStreams,
  notification: Record<string, unknown>
): void {
  child.stdout.push(`${JSON.stringify(notification)}\n`)
}

describe('CodexAppServerBridge', () => {
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
    expect(fake.requests.map((request) => request.method)).toEqual([
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
    expect(fake.requests.map((request) => request.method)).toEqual([
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

    bridge.setEventHandler((event) => {
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

  it('ignores agent message notifications from other threads', async () => {
    const fake = createFakeAppServer()
    const events: CodexAppServerEvent[] = []
    const bridge = new CodexAppServerBridge({
      threadId: 'thread-1',
      spawnFn: fake.spawnFn,
    })

    bridge.setEventHandler((event) => {
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
})
