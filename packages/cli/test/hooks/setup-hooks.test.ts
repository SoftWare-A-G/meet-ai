import { describe, test, expect, beforeEach, afterEach, spyOn } from 'bun:test'
import { existsSync } from 'node:fs'
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  setupHooks,
  MEET_AI_HOOKS,
  mergeHooks,
  removeHooks,
} from '../../src/commands/setup-hooks/usecase'

let tempDir: string
let settingsFile: string

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'setup-hooks-'))
  settingsFile = join(tempDir, 'settings.json')
})

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true })
})

const opts = (overrides: Partial<Parameters<typeof setupHooks>[0]> = {}) => ({
  project: false,
  dryRun: false,
  remove: false,
  _settingsPath: settingsFile,
  ...overrides,
})

describe('setup-hooks', () => {
  test('creates settings.json if it does not exist', async () => {
    await setupHooks(opts())
    const content = JSON.parse(await readFile(settingsFile, 'utf-8'))
    expect(content.hooks).toBeDefined()
    expect(content.hooks.PostToolUse).toHaveLength(1)
    expect(content.hooks.PermissionRequest).toHaveLength(3)
  })

  test('merges hooks into existing settings and preserves other keys', async () => {
    const existing = {
      env: { MEET_AI_URL: 'https://meet-ai.cc' },
      permissions: { allow: ['Read'] },
    }
    await writeFile(settingsFile, JSON.stringify(existing, null, 2))

    await setupHooks(opts())

    const content = JSON.parse(await readFile(settingsFile, 'utf-8'))
    expect(content.env).toEqual({ MEET_AI_URL: 'https://meet-ai.cc' })
    expect(content.permissions).toEqual({ allow: ['Read'] })
    expect(content.hooks.PostToolUse).toHaveLength(1)
    expect(content.hooks.PostToolUse[0].hooks[0].command).toBe('meet-ai hook log-tool-use')
    expect(content.hooks.PermissionRequest).toHaveLength(3)
  })

  test('preserves non-meet-ai hooks during merge', async () => {
    const existing = {
      hooks: {
        PostToolUse: [
          { matcher: 'Bash', hooks: [{ type: 'command', command: 'echo hello', timeout: 5 }] },
        ],
      },
    }
    await writeFile(settingsFile, JSON.stringify(existing, null, 2))

    await setupHooks(opts())

    const content = JSON.parse(await readFile(settingsFile, 'utf-8'))
    // Original non-meet-ai hook preserved + meet-ai hook added
    expect(content.hooks.PostToolUse).toHaveLength(2)
    expect(content.hooks.PostToolUse[0].hooks[0].command).toBe('echo hello')
    expect(content.hooks.PostToolUse[1].hooks[0].command).toBe('meet-ai hook log-tool-use')
  })

  test('--dry-run prints but does not write', async () => {
    const logSpy = spyOn(console, 'log').mockImplementation(() => {})
    await setupHooks(opts({ dryRun: true }))
    logSpy.mockRestore()

    // File should NOT exist
    expect(existsSync(settingsFile)).toBe(false)
  })

  test('--remove removes meet-ai hook entries', async () => {
    // First add hooks
    await setupHooks(opts())
    // Then remove
    await setupHooks(opts({ remove: true }))

    const content = JSON.parse(await readFile(settingsFile, 'utf-8'))
    // hooks key should be removed entirely since all hooks were meet-ai
    expect(content.hooks).toBeUndefined()
  })

  test('--remove preserves non-meet-ai hooks', async () => {
    const existing = {
      hooks: {
        PostToolUse: [
          { matcher: 'Bash', hooks: [{ type: 'command', command: 'echo hello', timeout: 5 }] },
          {
            matcher: '.*',
            hooks: [{ type: 'command', command: 'meet-ai hook log-tool-use', timeout: 10 }],
          },
        ],
      },
    }
    await writeFile(settingsFile, JSON.stringify(existing, null, 2))

    await setupHooks(opts({ remove: true }))

    const content = JSON.parse(await readFile(settingsFile, 'utf-8'))
    expect(content.hooks.PostToolUse).toHaveLength(1)
    expect(content.hooks.PostToolUse[0].hooks[0].command).toBe('echo hello')
  })

  test('handles empty settings.json gracefully', async () => {
    await writeFile(settingsFile, '')

    await setupHooks(opts())

    const content = JSON.parse(await readFile(settingsFile, 'utf-8'))
    expect(content.hooks.PostToolUse).toHaveLength(1)
  })

  test('handles malformed JSON gracefully', async () => {
    await writeFile(settingsFile, '{ broken json }}}')

    await setupHooks(opts())

    const content = JSON.parse(await readFile(settingsFile, 'utf-8'))
    expect(content.hooks.PostToolUse).toHaveLength(1)
  })

  test('--project flag is accepted (path override takes precedence in test)', async () => {
    // With _settingsPath override the project flag doesn't matter,
    // but verify the option is accepted without error
    await setupHooks(opts({ project: true }))

    const content = JSON.parse(await readFile(settingsFile, 'utf-8'))
    expect(content.hooks.PostToolUse).toHaveLength(1)
    expect(content.hooks.PermissionRequest).toHaveLength(3)
  })

  test('updates existing meet-ai hooks on re-run (no duplicates)', async () => {
    await setupHooks(opts())
    await setupHooks(opts())

    const content = JSON.parse(await readFile(settingsFile, 'utf-8'))
    expect(content.hooks.PostToolUse).toHaveLength(1)
    expect(content.hooks.PermissionRequest).toHaveLength(3)
  })

  test('--remove with no meet-ai hooks prints info message', async () => {
    const existing = {
      hooks: {
        PostToolUse: [
          { matcher: 'Bash', hooks: [{ type: 'command', command: 'echo hello', timeout: 5 }] },
        ],
      },
    }
    await writeFile(settingsFile, JSON.stringify(existing, null, 2))

    const logSpy = spyOn(console, 'log').mockImplementation(() => {})
    await setupHooks(opts({ remove: true }))
    logSpy.mockRestore()

    // File should be unchanged
    const content = JSON.parse(await readFile(settingsFile, 'utf-8'))
    expect(content.hooks.PostToolUse).toHaveLength(1)
  })

  test('written file has trailing newline', async () => {
    await setupHooks(opts())
    const raw = await readFile(settingsFile, 'utf-8')
    expect(raw.endsWith('\n')).toBe(true)
  })

  test('creates parent directory if it does not exist', async () => {
    const nestedPath = join(tempDir, 'deep', 'nested', 'settings.json')
    await setupHooks(opts({ _settingsPath: nestedPath }))

    const content = JSON.parse(await readFile(nestedPath, 'utf-8'))
    expect(content.hooks.PostToolUse).toHaveLength(1)
  })
})

describe('mergeHooks', () => {
  test('adds all hooks to empty config', () => {
    const { merged, added } = mergeHooks({})
    expect(Object.keys(merged)).toEqual(['PostToolUse', 'PermissionRequest'])
    expect(added).toHaveLength(4)
  })

  test('reports updated when existing meet-ai hook found', () => {
    const existing = {
      PostToolUse: [
        {
          matcher: '.*',
          hooks: [{ type: 'command', command: 'meet-ai hook log-tool-use', timeout: 5 }],
        },
      ],
    }
    const { merged, added } = mergeHooks(existing)
    expect(merged.PostToolUse).toHaveLength(1)
    expect(added).toContain('updated PostToolUse [.*]')
  })
})

describe('upgrade path', () => {
  test('replaces old .* permission-review matcher with negative lookahead on re-run', async () => {
    const oldHooks = {
      hooks: {
        PostToolUse: [
          {
            matcher: '.*',
            hooks: [{ type: 'command', command: 'meet-ai hook log-tool-use', timeout: 10 }],
          },
        ],
        PermissionRequest: [
          {
            matcher: 'ExitPlanMode',
            hooks: [{ type: 'command', command: 'meet-ai hook plan-review', timeout: 2592000 }],
          },
          {
            matcher: 'AskUserQuestion',
            hooks: [{ type: 'command', command: 'meet-ai hook question-review', timeout: 1800 }],
          },
          {
            matcher: '.*',
            hooks: [{ type: 'command', command: 'meet-ai hook permission-review', timeout: 1800 }],
          },
        ],
      },
    }
    await writeFile(settingsFile, JSON.stringify(oldHooks, null, 2))

    await setupHooks(opts())

    const content = JSON.parse(await readFile(settingsFile, 'utf-8'))
    const matchers = content.hooks.PermissionRequest.map((m: { matcher: string }) => m.matcher)
    // Old .* should be gone, replaced by negative lookahead
    expect(matchers).not.toContain('.*')
    expect(matchers).toContain('^(?!ExitPlanMode$|AskUserQuestion$).*')
    expect(content.hooks.PermissionRequest).toHaveLength(3)
  })

  test('updates old plan-review timeout from 2592000 to 2147483 on re-run', async () => {
    const oldHooks = {
      hooks: {
        PermissionRequest: [
          {
            matcher: 'ExitPlanMode',
            hooks: [{ type: 'command', command: 'meet-ai hook plan-review', timeout: 2592000 }],
          },
        ],
      },
    }
    await writeFile(settingsFile, JSON.stringify(oldHooks, null, 2))

    await setupHooks(opts())

    const content = JSON.parse(await readFile(settingsFile, 'utf-8'))
    const planReview = content.hooks.PermissionRequest.find(
      (m: { matcher: string }) => m.matcher === 'ExitPlanMode'
    )
    expect(planReview.hooks[0].timeout).toBe(2147483)
  })
})

describe('removeHooks', () => {
  test('removes all meet-ai hooks', () => {
    const { cleaned, removed } = removeHooks(MEET_AI_HOOKS)
    expect(Object.keys(cleaned)).toHaveLength(0)
    expect(removed).toHaveLength(4)
  })

  test('returns empty removed array when no meet-ai hooks', () => {
    const hooks = {
      PostToolUse: [
        { matcher: 'Bash', hooks: [{ type: 'command', command: 'echo hi', timeout: 5 }] },
      ],
    }
    const { cleaned, removed } = removeHooks(hooks)
    expect(removed).toHaveLength(0)
    expect(cleaned.PostToolUse).toHaveLength(1)
  })
})
