import { test, expect, beforeEach, afterEach } from 'bun:test'
import { rmSync } from 'node:fs'
import InboxRouter from '@meet-ai/cli/domain/services/InboxRouter'
import type IFileSystem from '@meet-ai/cli/domain/interfaces/IFileSystem'

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

let mockFs: ReturnType<typeof createMockFs>
let router: InboxRouter
const savedHome = process.env.HOME

beforeEach(() => {
  mockFs = createMockFs()
  router = new InboxRouter(mockFs)
  process.env.HOME = '/tmp/meet-ai-domain-inbox-router'
})

afterEach(() => {
  if (savedHome === undefined) delete process.env.HOME
  else process.env.HOME = savedHome
  rmSync('/tmp/meet-ai-domain-inbox-router', { recursive: true, force: true })
})

// --- route: writes to correct inbox path ---

test('route writes to @mentioned agent inbox', () => {
  mockFs.files['/teams/my-team/config.json'] = JSON.stringify({
    members: [{ name: 'researcher' }, { name: 'formatter' }],
  })

  router.route(
    { sender: 'human', content: '@researcher check this' },
    {
      inboxDir: '/inboxes',
      inbox: 'team-lead',
      teamDir: '/teams/my-team',
      roomId: 'test-room',
    }
  )

  expect(mockFs.files['/inboxes/researcher.json']).toBeDefined()
  const messages = JSON.parse(mockFs.files['/inboxes/researcher.json'])
  expect(messages).toHaveLength(1)
  expect(messages[0].from).toBe('meet-ai:human')
  expect(messages[0].text).toBe('@researcher check this')
  // Should NOT write to default inbox
  expect(mockFs.files['/inboxes/team-lead.json']).toBeUndefined()
})

test('route writes to multiple @mentioned agent inboxes', () => {
  mockFs.files['/teams/t/config.json'] = JSON.stringify({
    members: [{ name: 'researcher' }, { name: 'formatter' }],
  })

  router.route(
    { sender: 'user', content: '@researcher @formatter look at this' },
    {
      inboxDir: '/inboxes',
      inbox: 'team-lead',
      teamDir: '/teams/t',
      roomId: 'test-room',
    }
  )

  expect(mockFs.files['/inboxes/researcher.json']).toBeDefined()
  expect(mockFs.files['/inboxes/formatter.json']).toBeDefined()
})

test('route writes to orchestrator inbox when no @mentions', () => {
  mockFs.files['/teams/t/config.json'] = JSON.stringify({
    members: [{ name: 'researcher' }],
  })

  router.route(
    { sender: 'human', content: 'hello everyone' },
    {
      inboxDir: '/inboxes',
      inbox: 'team-lead',
      teamDir: '/teams/t',
      roomId: 'test-room',
    }
  )

  expect(mockFs.files['/inboxes/team-lead.json']).toBeDefined()
  const messages = JSON.parse(mockFs.files['/inboxes/team-lead.json'])
  expect(messages).toHaveLength(1)
  expect(messages[0].text).toBe('hello everyone')
})

test('route includes attachment paths in entry', () => {
  mockFs.files['/teams/t/config.json'] = JSON.stringify({
    members: [{ name: 'dev' }],
  })

  router.route(
    { sender: 'human', content: '@dev here is a file' },
    {
      inboxDir: '/inboxes',
      inbox: 'team-lead',
      teamDir: '/teams/t',
      roomId: 'test-room',
      attachmentPaths: ['/tmp/file.png'],
    }
  )

  const messages = JSON.parse(mockFs.files['/inboxes/dev.json'])
  expect(messages[0].attachments).toEqual(['/tmp/file.png'])
})

test('route appends to existing inbox file', () => {
  mockFs.files['/teams/t/config.json'] = JSON.stringify({
    members: [{ name: 'dev' }],
  })
  mockFs.files['/inboxes/dev.json'] = JSON.stringify([
    { from: 'old', text: 'old', timestamp: '2026-01-01T00:00:00Z', read: true },
  ])

  router.route(
    { sender: 'human', content: '@dev new message' },
    {
      inboxDir: '/inboxes',
      inbox: 'team-lead',
      teamDir: '/teams/t',
      roomId: 'test-room',
    }
  )

  const messages = JSON.parse(mockFs.files['/inboxes/dev.json'])
  expect(messages).toHaveLength(2)
  expect(messages[1].text).toBe('@dev new message')
})

// --- route: handles @mention routing correctly ---

test('route sends to orchestrator inbox when all @mentions are invalid', () => {
  mockFs.files['/teams/t/config.json'] = JSON.stringify({
    members: [{ name: 'researcher' }],
  })

  router.route(
    { sender: 'human', content: '@nobody where are you?' },
    {
      inboxDir: '/inboxes',
      inbox: 'lead',
      teamDir: '/teams/t',
      roomId: 'test-room',
    }
  )

  // Invalid mention → no targeted inbox
  expect(mockFs.files['/inboxes/nobody.json']).toBeUndefined()
  // Invalid mentions treated as no mentions → routes to orchestrator
  expect(mockFs.files['/inboxes/lead.json']).toBeDefined()
})

test('route sends to orchestrator inbox when team config is missing and @mention is invalid', () => {
  // No config.json in mock → getTeamMembers returns empty set

  router.route(
    { sender: 'human', content: '@researcher hello' },
    {
      inboxDir: '/inboxes',
      inbox: 'lead',
      teamDir: '/teams/missing',
      roomId: 'test-room',
    }
  )

  // No valid members → all mentions invalid → treated as no mentions → orchestrator
  expect(mockFs.files['/inboxes/researcher.json']).toBeUndefined()
  expect(mockFs.files['/inboxes/lead.json']).toBeDefined()
})

test('route uses per-room usernames when team config is missing', () => {
  mockFs.files['/tmp/meet-ai-domain-inbox-router/.meet-ai/rooms/room-123/config.json'] =
    JSON.stringify({
      roomId: 'room-123',
      usernames: ['researcher', 'team-lead'],
    })

  router.route(
    { sender: 'human', content: '@researcher hello' },
    {
      inboxDir: '/inboxes',
      inbox: 'lead',
      teamDir: '/teams/missing',
      roomId: 'room-123',
    }
  )

  expect(mockFs.files['/inboxes/researcher.json']).toBeDefined()
  expect(mockFs.files['/inboxes/lead.json']).toBeUndefined()
})

// --- checkIdle ---

test('checkIdle detects idle agents and writes to inbox', () => {
  const staleTime = Date.now() - 6 * 60 * 1000 // 6 min ago
  mockFs.files['/teams/t/config.json'] = JSON.stringify({
    members: [{ name: 'team-lead' }, { name: 'researcher' }],
  })

  // Override statSync to return stale mtime
  const origStat = mockFs.statSync.bind(mockFs)
  mockFs.statSync = (path: string) => {
    if (path === '/inboxes/researcher.json') {
      return { mtimeMs: staleTime, size: 2 }
    }
    return origStat(path)
  }
  mockFs.files['/inboxes/researcher.json'] = '[]'

  const notified = new Set<string>()
  router.checkIdle({
    inboxDir: '/inboxes',
    teamDir: '/teams/t',
    roomId: 'test-room',
    inbox: 'team-lead',
    notified,
  })

  expect(notified.has('researcher')).toBe(true)
  expect(mockFs.files['/inboxes/team-lead.json']).toBeDefined()
  const messages = JSON.parse(mockFs.files['/inboxes/team-lead.json'])
  expect(messages[0].text).toContain('researcher idle')
})
