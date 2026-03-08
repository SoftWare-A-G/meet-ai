import { test, expect, describe, beforeEach } from 'bun:test'
import { resolveInboxTargets } from '@meet-ai/cli/inbox-router'
import InboxRouter from '@meet-ai/cli/domain/services/InboxRouter'
import type IFileSystem from '@meet-ai/cli/domain/interfaces/IFileSystem'

// --- resolveInboxTargets guard: non-string content ---

describe('resolveInboxTargets guard path', () => {
  const members = new Set(['researcher', 'formatter'])

  test('returns null when content is undefined', () => {
    expect(resolveInboxTargets(undefined, members)).toBeNull()
  })

  test('returns null when content is missing (called with no first arg)', () => {
    // Simulates a caller destructuring a message object that has no content field
    const msg: { content?: string } = {}
    expect(resolveInboxTargets(msg.content, members)).toBeNull()
  })

  test('still works for normal string content with @mentions', () => {
    expect(resolveInboxTargets('@researcher check this', members)).toEqual(['researcher'])
  })

  test('still returns null for string content with no mentions', () => {
    expect(resolveInboxTargets('hello everyone', members)).toBeNull()
  })
})

// --- InboxRouter.route guard: non-string content ---

function createMockFs(
  files: Record<string, string> = {}
): IFileSystem & { files: Record<string, string> } {
  const store: Record<string, string> = { ...files }
  return {
    files: store,
    readFileSync(path: string, _encoding: BufferEncoding): string {
      if (!(path in store)) throw new Error(`ENOENT: ${path}`)
      return store[path]
    },
    writeFileSync(path: string, data: string): void {
      store[path] = data
    },
    mkdirSync(): void {},
    existsSync(path: string): boolean {
      return path in store
    },
    statSync(path: string): { mtimeMs: number; size: number } {
      if (!(path in store)) throw new Error(`ENOENT: ${path}`)
      return { mtimeMs: Date.now(), size: store[path].length }
    },
  }
}

describe('InboxRouter.route guard path', () => {
  let mockFs: ReturnType<typeof createMockFs>
  let router: InboxRouter

  const routeOpts = {
    inboxDir: '/inboxes',
    defaultInboxPath: '/inboxes/team-lead.json',
    teamDir: '/teams/t',
  }

  beforeEach(() => {
    mockFs = createMockFs({
      '/teams/t/config.json': JSON.stringify({
        members: [{ name: 'researcher' }, { name: 'formatter' }],
      }),
    })
    router = new InboxRouter(mockFs)
  })

  test('does not crash and writes nothing when content is undefined', () => {
    router.route(
      { sender: 'system', content: undefined },
      routeOpts
    )

    // No inbox files should have been created
    expect(mockFs.files['/inboxes/researcher.json']).toBeUndefined()
    expect(mockFs.files['/inboxes/formatter.json']).toBeUndefined()
    expect(mockFs.files['/inboxes/team-lead.json']).toBeUndefined()
  })

  test('does not crash and writes nothing when content is missing entirely', () => {
    // Cast to simulate a WebSocket message like { type: "commands_info", commands: [...] }
    router.route(
      { sender: 'system' } as { sender: string; content?: string },
      routeOpts
    )

    expect(mockFs.files['/inboxes/researcher.json']).toBeUndefined()
    expect(mockFs.files['/inboxes/formatter.json']).toBeUndefined()
    expect(mockFs.files['/inboxes/team-lead.json']).toBeUndefined()
  })

  test('does not crash for commands_info-shaped message without content', () => {
    // Simulates the actual WebSocket messages that triggered the bug
    const commandsInfoMsg = { type: 'commands_info', sender: 'server', commands: ['/help'] } as any
    router.route(commandsInfoMsg, routeOpts)

    expect(mockFs.files['/inboxes/researcher.json']).toBeUndefined()
    expect(mockFs.files['/inboxes/team-lead.json']).toBeUndefined()
  })

  test('does not crash for team_info-shaped message without content', () => {
    const teamInfoMsg = { type: 'team_info', sender: 'server', members: ['a', 'b'] } as any
    router.route(teamInfoMsg, routeOpts)

    expect(mockFs.files['/inboxes/researcher.json']).toBeUndefined()
    expect(mockFs.files['/inboxes/team-lead.json']).toBeUndefined()
  })

  test('does not crash for tasks_info-shaped message without content', () => {
    const tasksInfoMsg = { type: 'tasks_info', sender: 'server', tasks: [] } as any
    router.route(tasksInfoMsg, routeOpts)

    expect(mockFs.files['/inboxes/researcher.json']).toBeUndefined()
    expect(mockFs.files['/inboxes/team-lead.json']).toBeUndefined()
  })

  test('still routes normal string content to @mentioned inbox', () => {
    router.route(
      { sender: 'human', content: '@researcher check this' },
      routeOpts
    )

    expect(mockFs.files['/inboxes/researcher.json']).toBeDefined()
    const messages = JSON.parse(mockFs.files['/inboxes/researcher.json'])
    expect(messages).toHaveLength(1)
    expect(messages[0].text).toBe('@researcher check this')
  })

  test('still routes normal string content without mentions to default inbox', () => {
    router.route(
      { sender: 'human', content: 'hello everyone' },
      routeOpts
    )

    expect(mockFs.files['/inboxes/team-lead.json']).toBeDefined()
    const messages = JSON.parse(mockFs.files['/inboxes/team-lead.json'])
    expect(messages).toHaveLength(1)
    expect(messages[0].text).toBe('hello everyone')
  })
})
