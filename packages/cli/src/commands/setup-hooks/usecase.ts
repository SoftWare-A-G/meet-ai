import { existsSync } from 'node:fs'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { resolve, dirname } from 'node:path'
import pc from 'picocolors'
import { ok, info } from '../../lib/output'

interface HookEntry {
  type: string
  command: string
  timeout: number
}

interface HookMatcher {
  matcher: string
  hooks: HookEntry[]
}

interface HooksConfig {
  [event: string]: HookMatcher[]
}

const MEET_AI_HOOKS: HooksConfig = {
  PostToolUse: [
    {
      matcher: '.*',
      hooks: [
        {
          type: 'command',
          command: 'meet-ai hook log-tool-use',
          timeout: 10,
        },
      ],
    },
  ],
  PermissionRequest: [
    {
      matcher: 'ExitPlanMode',
      hooks: [
        {
          type: 'command',
          command: 'meet-ai hook plan-review',
          timeout: 2147483,
        },
      ],
    },
    {
      matcher: 'AskUserQuestion',
      hooks: [
        {
          type: 'command',
          command: 'meet-ai hook question-review',
          timeout: 1800,
        },
      ],
    },
    {
      matcher: '^(?!ExitPlanMode$|AskUserQuestion$).*',
      hooks: [
        {
          type: 'command',
          command: 'meet-ai hook permission-review',
          timeout: 1800,
        },
      ],
    },
  ],
}

function isMeetAiHook(entry: HookMatcher): boolean {
  return (
    entry.hooks?.some(
      h => typeof h.command === 'string' && h.command.startsWith('meet-ai hook ')
    ) ?? false
  )
}

function getSettingsPath(project: boolean): string {
  if (project) {
    return resolve(process.cwd(), '.claude', 'settings.json')
  }
  return resolve(homedir(), '.claude', 'settings.json')
}

async function readSettings(path: string): Promise<Record<string, unknown>> {
  if (!existsSync(path)) {
    return {}
  }
  const raw = await readFile(path, 'utf-8')
  const trimmed = raw.trim()
  if (!trimmed) return {}
  try {
    return JSON.parse(trimmed)
  } catch {
    return {}
  }
}

function mergeHooks(existing: HooksConfig): { merged: HooksConfig; added: string[] } {
  const result: HooksConfig = { ...existing }
  const added: string[] = []

  for (const [event, matchers] of Object.entries(MEET_AI_HOOKS)) {
    if (!result[event]) {
      result[event] = []
    }

    for (const newMatcher of matchers) {
      const existingIdx = result[event].findIndex(
        (m: HookMatcher) => m.matcher === newMatcher.matcher && isMeetAiHook(m)
      )

      if (existingIdx >= 0) {
        result[event][existingIdx] = newMatcher
        added.push(`updated ${event} [${newMatcher.matcher}]`)
      } else {
        result[event].push(newMatcher)
        added.push(`added ${event} [${newMatcher.matcher}]`)
      }
    }
  }

  // Remove stale meet-ai hooks (matcher changed between versions)
  for (const event of Object.keys(result)) {
    const newMatchers = MEET_AI_HOOKS[event] ?? []
    result[event] = result[event].filter((m: HookMatcher) => {
      if (!isMeetAiHook(m)) return true
      return newMatchers.some(nm => nm.matcher === m.matcher)
    })
    if (result[event].length === 0) delete result[event]
  }

  return { merged: result, added }
}

function removeHooks(existing: HooksConfig): { cleaned: HooksConfig; removed: string[] } {
  const result: HooksConfig = {}
  const removed: string[] = []

  for (const [event, matchers] of Object.entries(existing)) {
    const kept = matchers.filter((m: HookMatcher) => {
      if (isMeetAiHook(m)) {
        removed.push(`removed ${event} [${m.matcher}]`)
        return false
      }
      return true
    })

    if (kept.length > 0) {
      result[event] = kept
    }
  }

  return { cleaned: result, removed }
}

export interface SetupHooksOptions {
  project: boolean
  dryRun: boolean
  remove: boolean
  /** Override settings path (for testing) */
  _settingsPath?: string
}

export async function setupHooks(options: SetupHooksOptions): Promise<void> {
  const settingsPath = options._settingsPath ?? getSettingsPath(options.project)
  const settings = await readSettings(settingsPath)
  const existingHooks = (settings.hooks ?? {}) as HooksConfig

  if (options.remove) {
    const { cleaned, removed } = removeHooks(existingHooks)

    if (removed.length === 0) {
      info('No meet-ai hooks found to remove.')
      return
    }

    if (options.dryRun) {
      info(`Dry run — would modify ${settingsPath}:`)
      for (const r of removed) {
        console.log(pc.yellow(`  ${r}`))
      }
      return
    }

    const updated = { ...settings, hooks: cleaned }
    if (Object.keys(cleaned).length === 0) {
      delete (updated as Record<string, unknown>).hooks
    }
    await mkdir(dirname(settingsPath), { recursive: true })
    await writeFile(settingsPath, JSON.stringify(updated, null, 2) + '\n')

    for (const r of removed) {
      console.log(pc.yellow(`  ${r}`))
    }
    ok(`Removed meet-ai hooks from ${settingsPath}`)
  } else {
    const { merged, added } = mergeHooks(existingHooks)

    if (options.dryRun) {
      info(`Dry run — would modify ${settingsPath}:`)
      for (const a of added) {
        console.log(pc.green(`  ${a}`))
      }
      return
    }

    const updated = { ...settings, hooks: merged }
    await mkdir(dirname(settingsPath), { recursive: true })
    await writeFile(settingsPath, JSON.stringify(updated, null, 2) + '\n')

    for (const a of added) {
      console.log(pc.green(`  ${a}`))
    }
    ok(`Hooks written to ${settingsPath}`)
  }
}

// Exported for testing
export { MEET_AI_HOOKS, isMeetAiHook, getSettingsPath, readSettings, mergeHooks, removeHooks }
