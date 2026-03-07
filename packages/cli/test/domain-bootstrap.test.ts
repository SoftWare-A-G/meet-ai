import { test, expect, describe, beforeEach, afterEach } from 'bun:test'

// Set env vars before importing bootstrap so getMeetAiConfig() succeeds
const ORIGINAL_ENV = { ...process.env }

beforeEach(() => {
  process.env.MEET_AI_URL = 'https://test.example.com'
  process.env.MEET_AI_KEY = 'mai_testkey1234567890abcdef'
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  // Reset the singleton between tests by clearing the module cache
  // Bun re-evaluates modules when we use dynamic import with cache busting,
  // but for static imports we need to reset the container manually.
})

describe('getContainer', () => {
  test('returns an object with all expected use case properties', async () => {
    // Re-import to pick up env vars
    const { getContainer } = await import('@meet-ai/cli/domain/bootstrap')
    const container = getContainer()

    const expectedKeys = [
      'sendMessage',
      'createRoom',
      'deleteRoom',
      'sendLog',
      'sendTeamInfo',
      'sendCommands',
      'sendTasks',
      'sendTerminalData',
      'listen',
      'listenLobby',
      'poll',
      'generateKey',
      'getAttachments',
      'downloadAttachment',
      'inboxRouter',
    ]

    for (const key of expectedKeys) {
      expect(container).toHaveProperty(key)
    }
  })

  test('all use cases have execute methods', async () => {
    const { getContainer } = await import('@meet-ai/cli/domain/bootstrap')
    const container = getContainer()

    const useCaseKeys = [
      'sendMessage',
      'createRoom',
      'deleteRoom',
      'sendLog',
      'sendTeamInfo',
      'sendCommands',
      'sendTasks',
      'sendTerminalData',
      'listen',
      'listenLobby',
      'poll',
      'generateKey',
      'getAttachments',
      'downloadAttachment',
    ]

    for (const key of useCaseKeys) {
      const useCase = container[key as keyof typeof container]
      expect(typeof (useCase as any).execute).toBe('function')
    }
  })

  test('inboxRouter has route and checkIdle methods', async () => {
    const { getContainer } = await import('@meet-ai/cli/domain/bootstrap')
    const container = getContainer()

    expect(typeof container.inboxRouter.route).toBe('function')
    expect(typeof container.inboxRouter.checkIdle).toBe('function')
  })

  test('lazy singleton returns the same instance on repeated calls', async () => {
    const { getContainer } = await import('@meet-ai/cli/domain/bootstrap')
    const first = getContainer()
    const second = getContainer()

    expect(first).toBe(second)
  })
})

describe('getClient', () => {
  test('returns a MeetAiClient facade with all expected methods', async () => {
    const { getClient } = await import('@meet-ai/cli/domain/bootstrap')
    const client = getClient()

    const expectedMethods = [
      'createRoom',
      'sendMessage',
      'getMessages',
      'listen',
      'sendLog',
      'sendTeamInfo',
      'sendCommands',
      'sendTasks',
      'getMessageAttachments',
      'downloadAttachment',
      'listenLobby',
      'generateKey',
      'deleteRoom',
      'sendTerminalData',
    ]

    for (const method of expectedMethods) {
      expect(typeof (client as any)[method]).toBe('function')
    }
  })
})
