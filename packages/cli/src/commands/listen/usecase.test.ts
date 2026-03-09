import { describe, it, expect, mock, beforeEach, afterEach, spyOn } from 'bun:test'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { ZodError } from 'zod'
import { listen } from './usecase'
import type { CodexAppServerEvent } from '@meet-ai/cli/lib/codex-app-server'
import type { MeetAiClient, Message } from '@meet-ai/cli/types'
import type IInboxRouter from '@meet-ai/cli/domain/interfaces/IInboxRouter'

// Capture the onMessage callback passed to client.listen()
// so we can simulate incoming WebSocket messages in tests
type OnMessageFn = (msg: Message) => void

function getConsoleOutput(spy: ReturnType<typeof spyOn>): string {
  return spy.mock.calls
    .flat()
    .map((value: unknown) => String(value))
    .join('\n')
}

function makeCodexBridgeMock() {
  let eventHandler: ((event: CodexAppServerEvent) => void) | null = null
  return {
    injectText: mock(() => Promise.resolve({ mode: 'start' as const, threadId: 'thread-1', turnId: 'turn-1' })),
    injectPrompt: mock(() => Promise.resolve({ mode: 'start' as const, threadId: 'thread-1', turnId: 'turn-1' })),
    close: mock(() => Promise.resolve()),
    getCurrentModel: mock(() => 'gpt-5.4 (high)'),
    setEventHandler: mock((handler: ((event: CodexAppServerEvent) => void) | null) => {
      eventHandler = handler
    }),
    emitEvent: (event: CodexAppServerEvent) => {
      eventHandler?.(event)
    },
  }
}

function mockClient(overrides: Partial<MeetAiClient> = {}): MeetAiClient {
  return {
    listRooms: mock(() => Promise.resolve([])),
    createRoom: mock(() => Promise.reject(new Error('not implemented'))),
    sendMessage: mock(() => Promise.reject(new Error('not implemented'))),
    getMessages: mock(() => Promise.reject(new Error('not implemented'))),
    listen: mock(() => ({ readyState: 0, close: mock(() => {}) }) as unknown as WebSocket),
    sendLog: mock(() => Promise.reject(new Error('not implemented'))),
    sendTeamInfo: mock(() => Promise.reject(new Error('not implemented'))),
    sendTasks: mock(() => Promise.reject(new Error('not implemented'))),
    getMessageAttachments: mock(() => Promise.resolve([])),
    downloadAttachment: mock(() => Promise.reject(new Error('not implemented'))),
    generateKey: mock(() => Promise.reject(new Error('not implemented'))),
    deleteRoom: mock(() => Promise.reject(new Error('not implemented'))),
    sendTerminalData: mock(() => Promise.resolve()),
    ...overrides,
  } as MeetAiClient
}

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-001',
    roomId: 'df75b1db-f583-4d9f-8e34-9b3d614f152c',
    sender: 'alice',
    sender_type: 'human',
    content: 'hello',
    ...overrides,
  }
}

// Helper: create a client whose listen() captures the onMessage callback
function mockClientCapturingHandler(): {
  client: MeetAiClient
  getHandler: () => OnMessageFn
} {
  let captured: OnMessageFn | undefined
  const client = mockClient({
    listen: mock(
      (
        _roomId: string,
        options?: { exclude?: string; senderType?: string; onMessage?: OnMessageFn }
      ) => {
        captured = options?.onMessage
        return { readyState: 0, close: mock(() => {}) } as unknown as WebSocket
      }
    ),
  })
  return {
    client,
    getHandler: () => {
      if (!captured) throw new Error('onMessage was not captured — listen() was not called')
      return captured
    },
  }
}

function mockInboxRouter(): IInboxRouter {
  return {
    route: mock(() => {}),
    checkIdle: mock(() => {}),
  }
}

function makeTask(overrides: Partial<{
  id: string
  subject: string
  description?: string
  status: string
  assignee: string | null
  owner: string | null
  source: string
  source_id: string | null
  updated_by: string | null
  updated_at: number
}> = {}) {
  return {
    id: 'task-1',
    subject: 'Fix the bug',
    description: undefined,
    status: 'pending',
    assignee: null,
    owner: null,
    source: 'meet_ai',
    source_id: null,
    updated_by: null,
    updated_at: Date.now(),
    ...overrides,
  }
}

describe('listen', () => {
  let logSpy: ReturnType<typeof spyOn>
  let errorSpy: ReturnType<typeof spyOn>
  const originalExit = process.exit
  const originalOn = process.on
  const savedRuntime = process.env.MEET_AI_RUNTIME
  const savedCodexHome = process.env.CODEX_HOME
  const savedAgentName = process.env.MEET_AI_AGENT_NAME
  const savedHome = process.env.HOME
  const codexHome = '/tmp/meet-ai-listen-codex-home'

  function writeCodexSessionTranscript(sessionId: string, cwd: string) {
    mkdirSync(`${codexHome}/sessions/2026/03/08`, { recursive: true })
    writeFileSync(
      `${codexHome}/sessions/2026/03/08/${sessionId}.jsonl`,
      `${JSON.stringify({ type: 'session_meta', payload: { id: sessionId, cwd } })}\n`
    )
  }

  beforeEach(() => {
    logSpy = spyOn(console, 'log').mockImplementation(() => {})
    errorSpy = spyOn(console, 'error').mockImplementation(() => {})
    // Prevent process.exit from actually exiting during tests
    process.exit = mock(() => {}) as any
    rmSync(codexHome, { recursive: true, force: true })
    mkdirSync(codexHome, { recursive: true })
    delete process.env.MEET_AI_RUNTIME
    delete process.env.CODEX_HOME
    delete process.env.MEET_AI_AGENT_NAME
  })

  afterEach(() => {
    logSpy.mockRestore()
    errorSpy.mockRestore()
    process.exit = originalExit
    process.on = originalOn
    rmSync(codexHome, { recursive: true, force: true })
    if (savedRuntime === undefined) delete process.env.MEET_AI_RUNTIME
    else process.env.MEET_AI_RUNTIME = savedRuntime
    if (savedCodexHome === undefined) delete process.env.CODEX_HOME
    else process.env.CODEX_HOME = savedCodexHome
    if (savedAgentName === undefined) delete process.env.MEET_AI_AGENT_NAME
    else process.env.MEET_AI_AGENT_NAME = savedAgentName
    if (savedHome === undefined) delete process.env.HOME
    else process.env.HOME = savedHome
  })

  it('calls client.listen with correct roomId and options', () => {
    // GIVEN a mock client
    const client = mockClient()

    // WHEN we call listen with roomId and filters
    listen(client, {
      roomId: 'defd9c7e-cbd0-4653-ade1-1aaf402d1a62',
      exclude: 'bot',
      senderType: 'human',
    })

    // THEN client.listen is called with the right arguments
    expect(client.listen).toHaveBeenCalledWith('defd9c7e-cbd0-4653-ade1-1aaf402d1a62', {
      exclude: 'bot',
      senderType: 'human',
      onMessage: expect.any(Function),
    })
  })

  it('registers the active Claude member when team listen starts', async () => {
    const client = mockClient()
    const registerMember = mock(() => Promise.resolve())

    listen(
      client,
      {
        roomId: 'defd9c7e-cbd0-4653-ade1-1aaf402d1a62',
        team: 'demo-team',
        inbox: 'agent-1',
      },
      undefined,
      undefined,
      registerMember,
    )

    await new Promise(resolve => setTimeout(resolve, 0))

    expect(registerMember).toHaveBeenCalledWith({
      roomId: 'defd9c7e-cbd0-4653-ade1-1aaf402d1a62',
      teamName: 'demo-team',
      agentName: 'agent-1',
    })
  })

  it('prints received messages as JSON lines to stdout', () => {
    // GIVEN a client that captures the onMessage handler
    const { client, getHandler } = mockClientCapturingHandler()

    // WHEN we start listening and simulate a message
    listen(client, { roomId: 'df75b1db-f583-4d9f-8e34-9b3d614f152c' })
    const handler = getHandler()
    const msg = makeMessage({ id: 'msg-100', content: 'hello world' })
    handler(msg)

    // THEN the message is printed as a JSON line to stdout
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify(msg))
  })

  it('prints received messages via evlog for codex runtime', async () => {
    process.env.MEET_AI_RUNTIME = 'codex'
    process.env.CODEX_HOME = codexHome

    const { client, getHandler } = mockClientCapturingHandler()
    const codexBridge = makeCodexBridgeMock()

    listen(
      client,
      { roomId: 'df75b1db-f583-4d9f-8e34-9b3d614f152c', senderType: 'human' },
      undefined,
      codexBridge
    )
    const handler = getHandler()
    handler(
      makeMessage({
        id: 'msg-101',
        sender: 'alice',
        content: 'hello from meet-ai',
        created_at: '2026-03-08T00:00:00.000Z' as any,
      } as any)
    )
    await new Promise(resolve => setTimeout(resolve, 0))

    const output = getConsoleOutput(logSpy)
    expect(output).toContain('component:')
    expect(output).toContain('listen-codex')
    expect(output).toContain('event:')
    expect(output).toContain('room_message.received')
    expect(output).toContain('contentPreview:')
    expect(output).toContain('hello from meet-ai')
    expect(codexBridge.injectText).toHaveBeenCalledTimes(1)
    expect(output).toContain('injection.completed')
    expect(output).toContain('turnId:')
    expect(output).toContain('turn-1')
    expect(codexBridge.setEventHandler).toHaveBeenCalledWith(expect.any(Function))
  })

  it('registers the active Codex member when codex listen starts', async () => {
    process.env.MEET_AI_RUNTIME = 'codex'
    process.env.CODEX_HOME = codexHome
    process.env.MEET_AI_AGENT_NAME = 'my-codex'

    const client = mockClient()
    const codexBridge = makeCodexBridgeMock()
    const registerMember = mock(() => Promise.resolve())

    listen(
      client,
      { roomId: 'df75b1db-f583-4d9f-8e34-9b3d614f152c', senderType: 'human' },
      undefined,
      codexBridge,
      registerMember,
    )

    await new Promise(resolve => setTimeout(resolve, 0))

    expect(registerMember).toHaveBeenCalledWith({
      roomId: 'df75b1db-f583-4d9f-8e34-9b3d614f152c',
      agentName: 'my-codex',
      role: 'codex',
      model: 'gpt-5.4 (high)',
    })
  })

  it('resolves team name programmatically during codex listen', async () => {
    process.env.MEET_AI_RUNTIME = 'codex'
    process.env.CODEX_HOME = codexHome
    process.env.HOME = codexHome
    process.env.MEET_AI_AGENT_NAME = 'my-codex'

    writeCodexSessionTranscript('sess-team-bound', process.cwd())
    mkdirSync(`${codexHome}/.claude/teams/demo-team`, { recursive: true })
    writeFileSync(
      `${codexHome}/.claude/teams/demo-team/meet-ai.json`,
      JSON.stringify({
        session_id: 'sess-team-bound',
        room_id: 'df75b1db-f583-4d9f-8e34-9b3d614f152c',
        team_name: 'demo-team',
      })
    )

    const client = mockClient()
    const codexBridge = makeCodexBridgeMock()
    const registerMember = mock(() => Promise.resolve())

    listen(
      client,
      { roomId: 'df75b1db-f583-4d9f-8e34-9b3d614f152c', senderType: 'human' },
      undefined,
      codexBridge,
      registerMember,
    )

    await new Promise(resolve => setTimeout(resolve, 0))

    expect(registerMember).toHaveBeenCalledWith({
      roomId: 'df75b1db-f583-4d9f-8e34-9b3d614f152c',
      teamName: 'demo-team',
      agentName: 'my-codex',
      role: 'codex',
      model: 'gpt-5.4 (high)',
    })
  })

  it('returns the WebSocket from client.listen', () => {
    // GIVEN a mock client
    const fakeWs = { readyState: 1, close: mock(() => {}) } as unknown as WebSocket
    const client = mockClient({
      listen: mock(() => fakeWs),
    })

    // WHEN we call listen
    const result = listen(client, { roomId: 'df75b1db-f583-4d9f-8e34-9b3d614f152c' })

    // THEN it returns the WebSocket object
    expect(result).toBe(fakeWs)
  })

  it('does not route non-message payloads into Claude inboxes', () => {
    const { client, getHandler } = mockClientCapturingHandler()
    const inboxRouter = mockInboxRouter()

    listen(
      client,
      {
        roomId: 'df75b1db-f583-4d9f-8e34-9b3d614f152c',
        team: 'my-team',
        inbox: 'team-lead',
      },
      inboxRouter,
    )

    const handler = getHandler()
    handler({
      ...makeMessage({ id: 'msg-log', sender: 'hook', content: 'Agent activity' }),
      type: 'log',
    } as any)

    expect(inboxRouter.route).not.toHaveBeenCalled()
    expect(logSpy).not.toHaveBeenCalledWith(JSON.stringify(expect.objectContaining({ id: 'msg-log' })))
  })

  describe('validation', () => {
    it('throws ZodError when roomId is empty', () => {
      // GIVEN a client (won't be called because validation fails first)
      const client = mockClient()

      // WHEN we call listen with an empty roomId
      // THEN it throws a ZodError
      expect(() => listen(client, { roomId: '' })).toThrow(ZodError)
      expect(client.listen).not.toHaveBeenCalled()
    })

    it('throws ZodError when inbox is provided without team', () => {
      // GIVEN a client
      const client = mockClient()

      // WHEN we call listen with inbox but no team
      // THEN it throws a ZodError because --inbox requires --team
      expect(() =>
        listen(client, { roomId: 'df75b1db-f583-4d9f-8e34-9b3d614f152c', inbox: 'agent-1' })
      ).toThrow(ZodError)
      expect(client.listen).not.toHaveBeenCalled()
    })

    it('accepts inbox when team is also provided', () => {
      // GIVEN a client
      const client = mockClient()

      // WHEN we call listen with both team and inbox
      // THEN it does not throw
      expect(() =>
        listen(client, {
          roomId: 'df75b1db-f583-4d9f-8e34-9b3d614f152c',
          team: 'my-team',
          inbox: 'agent-1',
        })
      ).not.toThrow()
      expect(client.listen).toHaveBeenCalled()
    })
  })

  describe('message output with attachments', () => {
    it('enriches message with attachment paths when attachment_count > 0', async () => {
      // GIVEN a client that has downloadable attachments
      const { client, getHandler } = mockClientCapturingHandler()
      ;(client.getMessageAttachments as any).mockImplementation(() =>
        Promise.resolve([
          { id: 'att-1', filename: 'file.png', size: 100, content_type: 'image/png' },
        ])
      )
      ;(client as any).downloadAttachment = mock(() =>
        Promise.resolve('/tmp/meet-ai-attachments/att-1-file.png')
      )

      // WHEN we start listening and receive a message with attachments
      listen(client, { roomId: 'df75b1db-f583-4d9f-8e34-9b3d614f152c' })
      const handler = getHandler()
      const msg = {
        ...makeMessage({ id: 'msg-att' }),
        room_id: 'df75b1db-f583-4d9f-8e34-9b3d614f152c',
        attachment_count: 1,
      }
      handler(msg as any)

      // Wait for async attachment download
      await new Promise(resolve => setTimeout(resolve, 50))

      // THEN the output includes attachment paths
      const calls = (logSpy as any).mock.calls
      const lastCall = calls[calls.length - 1]?.[0]
      expect(lastCall).toBeDefined()
      const parsed = JSON.parse(lastCall)
      expect(parsed.attachments).toEqual(['/tmp/meet-ai-attachments/att-1-file.png'])
    })
  })

  it('queues inbound messages into Codex inbox when runtime is codex', async () => {
    process.env.MEET_AI_RUNTIME = 'codex'
    process.env.CODEX_HOME = codexHome

    const { client, getHandler } = mockClientCapturingHandler()
    const codexBridge = makeCodexBridgeMock()

    listen(client, { roomId: 'df75b1db-f583-4d9f-8e34-9b3d614f152c' }, undefined, codexBridge)
    const handler = getHandler()
    handler(makeMessage({ sender: 'human-1', content: 'ping codex' }))
    await new Promise(resolve => setTimeout(resolve, 0))

    const inboxPath = `${codexHome}/meet-ai/inbox/thread-1.json`
    const entries = JSON.parse(readFileSync(inboxPath, 'utf-8'))
    expect(entries).toHaveLength(1)
    expect(entries[0].from).toBe('meet-ai:human-1')
    expect(entries[0].text).toBe('ping codex')
    expect(codexBridge.injectText).toHaveBeenCalledWith(
      expect.objectContaining({
        sender: 'human-1',
        content: 'ping codex',
      })
    )
    const output = getConsoleOutput(logSpy)
    expect(output).toContain('injection.completed')
    expect(output).toContain('ping codex')
  })

  it('preserves attachment paths when queueing Codex inbox entries', async () => {
    process.env.MEET_AI_RUNTIME = 'codex'
    process.env.CODEX_HOME = codexHome

    const { client, getHandler } = mockClientCapturingHandler()
    const codexBridge = makeCodexBridgeMock()
    ;(client.getMessageAttachments as any).mockImplementation(() =>
      Promise.resolve([{ id: 'att-1', filename: 'file.png', size: 100, content_type: 'image/png' }])
    )
    ;(client as any).downloadAttachment = mock(() =>
      Promise.resolve('/tmp/meet-ai-attachments/att-1-file.png')
    )

    listen(client, { roomId: 'df75b1db-f583-4d9f-8e34-9b3d614f152c' }, undefined, codexBridge)
    const handler = getHandler()
    handler({
      ...makeMessage({ id: 'msg-codex-att', content: 'attachment for codex' }),
      room_id: 'df75b1db-f583-4d9f-8e34-9b3d614f152c',
      attachment_count: 1,
    } as any)

    await new Promise(resolve => setTimeout(resolve, 50))

    const inboxPath = `${codexHome}/meet-ai/inbox/thread-1.json`
    const entries = JSON.parse(readFileSync(inboxPath, 'utf-8'))
    expect(entries).toHaveLength(1)
    expect(entries[0].attachments).toEqual(['/tmp/meet-ai-attachments/att-1-file.png'])
    expect(codexBridge.injectText).toHaveBeenCalledWith(
      expect.objectContaining({
        sender: 'alice',
        content: 'attachment for codex',
        attachments: ['/tmp/meet-ai-attachments/att-1-file.png'],
      })
    )
    const output = getConsoleOutput(logSpy)
    expect(output).toContain('room_message.received')
    expect(output).toContain('attachmentCount:')
  })

  it('does not deliver non-message payloads to the Codex inbox', async () => {
    process.env.MEET_AI_RUNTIME = 'codex'
    process.env.CODEX_HOME = codexHome

    const { client, getHandler } = mockClientCapturingHandler()
    const codexBridge = makeCodexBridgeMock()

    listen(client, { roomId: 'df75b1db-f583-4d9f-8e34-9b3d614f152c' }, undefined, codexBridge)
    const handler = getHandler()
    handler({
      ...makeMessage({ id: 'msg-log', sender: 'hook', content: 'Agent activity' }),
      type: 'log',
    } as any)

    await new Promise(resolve => setTimeout(resolve, 0))

    expect(codexBridge.injectText).not.toHaveBeenCalled()
    expect(() => readFileSync(`${codexHome}/meet-ai/inbox/thread-1.json`, 'utf-8')).toThrow()
  })

  it('starts a fresh Codex session even when a workspace transcript exists', () => {
    process.env.MEET_AI_RUNTIME = 'codex'
    process.env.CODEX_HOME = codexHome
    writeCodexSessionTranscript('codex-sess-4', process.cwd())

    const client = mockClient()
    listen(
      client,
      { roomId: '835e152e-ff9c-4a68-8ab3-ad7815279c53', senderType: 'human' },
      undefined,
      makeCodexBridgeMock()
    )

    expect(client.listen).toHaveBeenCalledWith('835e152e-ff9c-4a68-8ab3-ad7815279c53', {
      exclude: undefined,
      senderType: 'human',
      onMessage: expect.any(Function),
    })
  })

  it('allows Codex listen to start without a pre-resolved session id', () => {
    process.env.MEET_AI_RUNTIME = 'codex'
    process.env.CODEX_HOME = codexHome

    const client = mockClient()
    const codexBridge = makeCodexBridgeMock()

    expect(() =>
      listen(
        client,
        { roomId: 'e6153411-c8af-4082-ab04-525b8c0e9467', senderType: 'human' },
        undefined,
        codexBridge
      )
    ).not.toThrow()
    expect(client.listen).toHaveBeenCalledWith('e6153411-c8af-4082-ab04-525b8c0e9467', {
      exclude: undefined,
      senderType: 'human',
      onMessage: expect.any(Function),
    })
  })

  it('rejects Claude-specific inbox routing flags in Codex runtime', () => {
    process.env.MEET_AI_RUNTIME = 'codex'
    process.env.CODEX_HOME = codexHome

    const client = mockClient()

    expect(() =>
      listen(client, {
        roomId: 'e6153411-c8af-4082-ab04-525b8c0e9467',
        team: 'codex-team',
        senderType: 'human',
      })
    ).toThrow(
      'Codex listen does not support Claude inbox routing flags (--team). Run meet-ai listen without Claude-specific routing options.'
    )
  })

  it('publishes completed Codex assistant output back to the room on turn completion', async () => {
    process.env.MEET_AI_RUNTIME = 'codex'
    process.env.CODEX_HOME = codexHome
    process.env.MEET_AI_CODEX_SESSION_ID = 'codex-sess-6'

    const client = mockClient({
      sendMessage: mock(() =>
        Promise.resolve({
          id: 'reply-1',
          roomId: 'df75b1db-f583-4d9f-8e34-9b3d614f152c',
          sender: 'codex',
          sender_type: 'agent',
          content: 'Hello world',
        })
      ),
    })
    const codexBridge = makeCodexBridgeMock()

    listen(
      client,
      { roomId: 'df75b1db-f583-4d9f-8e34-9b3d614f152c', senderType: 'human' },
      undefined,
      codexBridge
    )

    codexBridge.emitEvent({
      type: 'agent_message_delta',
      itemId: 'item-1',
      turnId: 'turn-1',
      text: 'Hello ',
    })
    codexBridge.emitEvent({
      type: 'agent_message_completed',
      itemId: 'item-1',
      turnId: 'turn-1',
      text: 'Hello world',
    })
    codexBridge.emitEvent({
      type: 'turn_completed',
      turnId: 'turn-1',
    })

    await new Promise(resolve => setTimeout(resolve, 0))

    expect(client.sendMessage).toHaveBeenCalledWith(
      'df75b1db-f583-4d9f-8e34-9b3d614f152c',
      'codex',
      'Hello world'
    )
  })

  it('flushes delta-only Codex output on turn completion', async () => {
    process.env.MEET_AI_RUNTIME = 'codex'
    process.env.CODEX_HOME = codexHome
    process.env.MEET_AI_CODEX_SESSION_ID = 'codex-sess-7'

    const client = mockClient({
      sendMessage: mock(() =>
        Promise.resolve({
          id: 'reply-2',
          roomId: 'df75b1db-f583-4d9f-8e34-9b3d614f152c',
          sender: 'codex',
          sender_type: 'agent',
          content: 'Hello world',
        })
      ),
    })
    const codexBridge = makeCodexBridgeMock()

    listen(
      client,
      { roomId: 'df75b1db-f583-4d9f-8e34-9b3d614f152c', senderType: 'human' },
      undefined,
      codexBridge
    )

    codexBridge.emitEvent({
      type: 'agent_message_delta',
      itemId: 'item-2',
      turnId: 'turn-2',
      text: 'Hello ',
    })
    codexBridge.emitEvent({
      type: 'agent_message_delta',
      itemId: 'item-2',
      turnId: 'turn-2',
      text: 'world',
    })
    codexBridge.emitEvent({
      type: 'turn_completed',
      turnId: 'turn-2',
    })

    await new Promise(resolve => setTimeout(resolve, 0))

    expect(client.sendMessage).toHaveBeenCalledWith(
      'df75b1db-f583-4d9f-8e34-9b3d614f152c',
      'codex',
      'Hello world'
    )
  })

  it('does not publish the same completed Codex message twice when turn completion follows immediately', async () => {
    process.env.MEET_AI_RUNTIME = 'codex'
    process.env.CODEX_HOME = codexHome
    process.env.MEET_AI_CODEX_SESSION_ID = 'codex-sess-8'

    const client = mockClient({
      sendMessage: mock(() =>
        Promise.resolve({
          id: 'reply-3',
          roomId: 'df75b1db-f583-4d9f-8e34-9b3d614f152c',
          sender: 'codex',
          sender_type: 'agent',
          content: 'Hello world',
        })
      ),
    })
    const codexBridge = makeCodexBridgeMock()

    listen(
      client,
      { roomId: 'df75b1db-f583-4d9f-8e34-9b3d614f152c', senderType: 'human' },
      undefined,
      codexBridge
    )

    codexBridge.emitEvent({
      type: 'agent_message_completed',
      itemId: 'item-3',
      turnId: 'turn-3',
      text: 'Hello world',
    })
    codexBridge.emitEvent({
      type: 'turn_completed',
      turnId: 'turn-3',
    })

    await new Promise(resolve => setTimeout(resolve, 0))

    expect(client.sendMessage).toHaveBeenCalledTimes(1)
    expect(client.sendMessage).toHaveBeenCalledWith(
      'df75b1db-f583-4d9f-8e34-9b3d614f152c',
      'codex',
      'Hello world'
    )
  })

  it('publishes a single combined Codex reply when one turn emits multiple completed items', async () => {
    process.env.MEET_AI_RUNTIME = 'codex'
    process.env.CODEX_HOME = codexHome
    process.env.MEET_AI_CODEX_SESSION_ID = 'codex-sess-9'

    const client = mockClient({
      sendMessage: mock(() =>
        Promise.resolve({
          id: 'reply-4',
          roomId: 'df75b1db-f583-4d9f-8e34-9b3d614f152c',
          sender: 'codex',
          sender_type: 'agent',
          content: 'First answer\n\nSecond answer',
        })
      ),
    })
    const codexBridge = makeCodexBridgeMock()

    listen(
      client,
      { roomId: 'df75b1db-f583-4d9f-8e34-9b3d614f152c', senderType: 'human' },
      undefined,
      codexBridge
    )

    codexBridge.emitEvent({
      type: 'agent_message_completed',
      itemId: 'item-4a',
      turnId: 'turn-4',
      text: 'First answer',
    })
    codexBridge.emitEvent({
      type: 'agent_message_completed',
      itemId: 'item-4b',
      turnId: 'turn-4',
      text: 'Second answer',
    })
    codexBridge.emitEvent({
      type: 'turn_completed',
      turnId: 'turn-4',
    })

    await new Promise(resolve => setTimeout(resolve, 0))

    expect(client.sendMessage).toHaveBeenCalledTimes(1)
    expect(client.sendMessage).toHaveBeenCalledWith(
      'df75b1db-f583-4d9f-8e34-9b3d614f152c',
      'codex',
      'First answer\n\nSecond answer'
    )
  })

  describe('tasks_info handling', () => {
    it('treats the first tasks_info as a baseline without injecting notifications', async () => {
      process.env.MEET_AI_RUNTIME = 'codex'
      process.env.CODEX_HOME = codexHome
      process.env.MEET_AI_AGENT_NAME = 'my-codex'

      const { client, getHandler } = mockClientCapturingHandler()
      const codexBridge = makeCodexBridgeMock()

      listen(client, { roomId: 'df75b1db-f583-4d9f-8e34-9b3d614f152c' }, undefined, codexBridge)
      const handler = getHandler()

      // First tasks_info is the cached snapshot — should be absorbed silently
      handler({
        type: 'tasks_info',
        tasks: [makeTask({
          id: 'task-1',
          subject: 'Fix the bug',
          description: 'Patch the failing listener path',
          assignee: 'my-codex',
          status: 'pending',
        })],
      } as any)

      await new Promise(resolve => setTimeout(resolve, 0))

      expect(codexBridge.injectText).not.toHaveBeenCalled()
      expect(logSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('[meet-ai:tasks]')
      )
    })

    it('injects a notification when a task is newly assigned after the baseline', async () => {
      process.env.MEET_AI_RUNTIME = 'codex'
      process.env.CODEX_HOME = codexHome
      process.env.MEET_AI_AGENT_NAME = 'my-codex'

      const { client, getHandler } = mockClientCapturingHandler()
      const codexBridge = makeCodexBridgeMock()

      listen(client, { roomId: 'df75b1db-f583-4d9f-8e34-9b3d614f152c' }, undefined, codexBridge)
      const handler = getHandler()

      // Baseline: no tasks yet
      handler({ type: 'tasks_info', tasks: [] } as any)

      await new Promise(resolve => setTimeout(resolve, 0))
      codexBridge.injectText.mockClear()

      // Second broadcast: new task assigned
      handler({
        type: 'tasks_info',
        tasks: [makeTask({
          id: 'task-1',
          subject: 'Fix the bug',
          description: 'Patch the failing listener path',
          assignee: 'my-codex',
          status: 'pending',
        })],
      } as any)

      await new Promise(resolve => setTimeout(resolve, 0))

      expect(codexBridge.injectText).toHaveBeenCalledWith(
        expect.objectContaining({
          sender: 'meet-ai',
          content: [
            'New task assigned to you:',
            'task_id: task-1',
            'subject: Fix the bug',
            'description: Patch the failing listener path',
            'status: pending',
            'assignee: my-codex',
          ].join('\n'),
        })
      )
      const output = getConsoleOutput(logSpy)
      expect(output).toContain('task.notification')
      expect(output).toContain('New task assigned to you:')
      expect(output).toContain('task_id: task-1')
    })

    it('does not inject notifications for tasks assigned to other agents', async () => {
      process.env.MEET_AI_RUNTIME = 'codex'
      process.env.CODEX_HOME = codexHome
      process.env.MEET_AI_AGENT_NAME = 'my-codex'

      const { client, getHandler } = mockClientCapturingHandler()
      const codexBridge = makeCodexBridgeMock()

      listen(client, { roomId: 'df75b1db-f583-4d9f-8e34-9b3d614f152c' }, undefined, codexBridge)
      const handler = getHandler()

      handler({
        type: 'tasks_info',
        tasks: [makeTask({ id: 'task-1', assignee: 'other-agent' })],
      } as any)

      await new Promise(resolve => setTimeout(resolve, 0))

      expect(codexBridge.injectText).not.toHaveBeenCalled()
    })

    it('injects a notification when task status changes for assigned agent', async () => {
      process.env.MEET_AI_RUNTIME = 'codex'
      process.env.CODEX_HOME = codexHome
      process.env.MEET_AI_AGENT_NAME = 'my-codex'

      const { client, getHandler } = mockClientCapturingHandler()
      const codexBridge = makeCodexBridgeMock()

      listen(client, { roomId: 'df75b1db-f583-4d9f-8e34-9b3d614f152c' }, undefined, codexBridge)
      const handler = getHandler()

      // First broadcast: task assigned
      handler({
        type: 'tasks_info',
        tasks: [makeTask({ id: 'task-1', assignee: 'my-codex', status: 'pending' })],
      } as any)

      await new Promise(resolve => setTimeout(resolve, 0))
      codexBridge.injectText.mockClear()

      // Second broadcast: status changed
      handler({
        type: 'tasks_info',
        tasks: [makeTask({ id: 'task-1', assignee: 'my-codex', status: 'in_progress' })],
      } as any)

      await new Promise(resolve => setTimeout(resolve, 0))

      expect(codexBridge.injectText).toHaveBeenCalledWith(
        expect.objectContaining({
          content: [
            'Task status changed (pending → in_progress):',
            'task_id: task-1',
            'subject: Fix the bug',
            'description: None',
            'status: in_progress',
            'assignee: my-codex',
          ].join('\n'),
        })
      )
    })

    it('does not inject when tasks_info has no changes for this agent', async () => {
      process.env.MEET_AI_RUNTIME = 'codex'
      process.env.CODEX_HOME = codexHome
      process.env.MEET_AI_AGENT_NAME = 'my-codex'

      const { client, getHandler } = mockClientCapturingHandler()
      const codexBridge = makeCodexBridgeMock()

      listen(client, { roomId: 'df75b1db-f583-4d9f-8e34-9b3d614f152c' }, undefined, codexBridge)
      const handler = getHandler()

      // First broadcast
      handler({
        type: 'tasks_info',
        tasks: [makeTask({ id: 'task-1', assignee: 'my-codex', status: 'pending' })],
      } as any)

      await new Promise(resolve => setTimeout(resolve, 0))
      codexBridge.injectText.mockClear()

      // Same broadcast again — no changes
      handler({
        type: 'tasks_info',
        tasks: [makeTask({ id: 'task-1', assignee: 'my-codex', status: 'pending' })],
      } as any)

      await new Promise(resolve => setTimeout(resolve, 0))

      expect(codexBridge.injectText).not.toHaveBeenCalled()
    })

    it('injects notification when task is reassigned to this agent', async () => {
      process.env.MEET_AI_RUNTIME = 'codex'
      process.env.CODEX_HOME = codexHome
      process.env.MEET_AI_AGENT_NAME = 'my-codex'

      const { client, getHandler } = mockClientCapturingHandler()
      const codexBridge = makeCodexBridgeMock()

      listen(client, { roomId: 'df75b1db-f583-4d9f-8e34-9b3d614f152c' }, undefined, codexBridge)
      const handler = getHandler()

      // First: assigned to someone else
      handler({
        type: 'tasks_info',
        tasks: [makeTask({ id: 'task-1', assignee: 'other-agent', status: 'pending' })],
      } as any)

      await new Promise(resolve => setTimeout(resolve, 0))
      codexBridge.injectText.mockClear()

      // Reassigned to this agent
      handler({
        type: 'tasks_info',
        tasks: [makeTask({ id: 'task-1', assignee: 'my-codex', status: 'pending' })],
      } as any)

      await new Promise(resolve => setTimeout(resolve, 0))

      expect(codexBridge.injectText).toHaveBeenCalledWith(
        expect.objectContaining({
          content: [
            'Task assigned to you:',
            'task_id: task-1',
            'subject: Fix the bug',
            'description: None',
            'status: pending',
            'assignee: my-codex',
          ].join('\n'),
        })
      )
    })

    it('does not treat tasks_info as a chat message', async () => {
      process.env.MEET_AI_RUNTIME = 'codex'
      process.env.CODEX_HOME = codexHome

      const { client, getHandler } = mockClientCapturingHandler()
      const codexBridge = makeCodexBridgeMock()

      listen(client, { roomId: 'df75b1db-f583-4d9f-8e34-9b3d614f152c' }, undefined, codexBridge)
      const handler = getHandler()

      handler({
        type: 'tasks_info',
        tasks: [],
      } as any)

      await new Promise(resolve => setTimeout(resolve, 0))

      // Should not inject any chat-type message
      expect(codexBridge.injectText).not.toHaveBeenCalled()
      // Should not log as a chat message format
      expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining('[meet-ai]'))
    })
  })
})
