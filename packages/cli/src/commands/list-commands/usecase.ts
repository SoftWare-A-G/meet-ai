import { existsSync } from 'node:fs'
import { readFile, readdir } from 'node:fs/promises'
import type { Dirent } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

export interface CommandEntry {
  name: string
  description: string
  type: 'command' | 'skill'
  source: `plugin:${string}` | 'standalone'
  scope: 'user' | 'project'
}

export interface ListCommandsOptions {
  projectPath?: string
  /** Override ~/.claude dir (for testing) */
  _userClaudeDir?: string
  /** Override plugins file path (for testing) */
  _pluginsFile?: string
}

function parseYamlFrontmatter(content: string): { name?: string; description?: string } | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return null
  const body = match[1]
  const nameMatch = body.match(/^name:\s*(.+)$/m)
  const descMatch = body.match(/^description:\s*(.+)$/m)
  return {
    name: nameMatch?.[1]?.trim(),
    description: descMatch?.[1]?.trim(),
  }
}

async function readSkillsFromDir(
  baseDir: string,
  source: CommandEntry['source'],
  scope: CommandEntry['scope']
): Promise<CommandEntry[]> {
  const skillsDir = join(baseDir, 'skills')
  if (!existsSync(skillsDir)) return []

  let entries: string[]
  try {
    entries = await readdir(skillsDir)
  } catch {
    return []
  }

  const results: CommandEntry[] = []
  for (const entry of entries) {
    const skillFile = join(skillsDir, entry, 'SKILL.md')
    if (!existsSync(skillFile)) continue
    try {
      const content = await readFile(skillFile, 'utf-8')
      const fm = parseYamlFrontmatter(content)
      if (!fm) continue
      if (!fm.description) continue
      results.push({
        name: fm.name ?? entry,
        description: fm.description,
        type: 'skill',
        source,
        scope,
      })
    } catch {
      // skip unreadable files
    }
  }
  return results
}

async function readCommandsFromDir(
  commandsDir: string,
  source: `plugin:${string}`,
  scope: CommandEntry['scope']
): Promise<CommandEntry[]> {
  if (!existsSync(commandsDir)) return []

  const results: CommandEntry[] = []

  async function scanDir(dir: string) {
    let entries: Dirent[]
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        await scanDir(fullPath)
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        try {
          const content = await readFile(fullPath, 'utf-8')
          const fm = parseYamlFrontmatter(content)
          if (!fm || !fm.description) continue
          // Use filename without .md as fallback name
          const fallbackName = entry.name.slice(0, -3)
          results.push({
            name: fm.name ?? fallbackName,
            description: fm.description,
            type: 'command',
            source,
            scope,
          })
        } catch {
          // skip unreadable files
        }
      }
    }
  }

  await scanDir(commandsDir)
  return results
}

async function readSettings(settingsPath: string): Promise<Record<string, unknown>> {
  if (!existsSync(settingsPath)) return {}
  try {
    const raw = await readFile(settingsPath, 'utf-8')
    return JSON.parse(raw.trim() || '{}')
  } catch {
    return {}
  }
}

async function readInstalledPlugins(
  pluginsFile: string
): Promise<Record<string, Array<{ scope: string; installPath: string; version: string }>>> {
  if (!existsSync(pluginsFile)) return {}
  try {
    const raw = await readFile(pluginsFile, 'utf-8')
    const parsed = JSON.parse(raw)
    return parsed.plugins ?? {}
  } catch {
    return {}
  }
}

export async function listCommands(options: ListCommandsOptions): Promise<CommandEntry[]> {
  const projectPath = resolve(options.projectPath ?? process.cwd())
  const userClaudeDir = options._userClaudeDir ?? join(homedir(), '.claude')
  const pluginsFile =
    options._pluginsFile ?? join(homedir(), '.claude', 'plugins', 'installed_plugins.json')

  const results: CommandEntry[] = []

  // 1. Standalone skills (user)
  const userSkills = await readSkillsFromDir(userClaudeDir, 'standalone', 'user')
  results.push(...userSkills)

  // 3. Standalone skills (project)
  const projectClaudeDir = join(projectPath, '.claude')
  const projectSkills = await readSkillsFromDir(projectClaudeDir, 'standalone', 'project')
  results.push(...projectSkills)

  // 4 & 5. Plugin commands + skills
  const userSettings = await readSettings(join(userClaudeDir, 'settings.json'))
  const projectSettings = await readSettings(join(projectClaudeDir, 'settings.json'))

  const userEnabled = (userSettings.enabledPlugins ?? {}) as Record<string, unknown>
  const projectEnabled = (projectSettings.enabledPlugins ?? {}) as Record<string, unknown>

  // Merge: collect all enabled plugin scope names with their origin scope
  const enabledPlugins = new Map<string, 'user' | 'project'>()
  for (const scopeName of Object.keys(userEnabled)) {
    enabledPlugins.set(scopeName, 'user')
  }
  for (const scopeName of Object.keys(projectEnabled)) {
    enabledPlugins.set(scopeName, 'project')
  }

  if (enabledPlugins.size > 0) {
    const installedPlugins = await readInstalledPlugins(pluginsFile)

    for (const [scopeName, pluginScope] of enabledPlugins) {
      const installations = installedPlugins[scopeName]
      if (!installations || installations.length === 0) continue

      // Use the first (most recent) installation
      const { installPath } = installations[0]

      const source: `plugin:${string}` = `plugin:${scopeName}`

      const pluginCommands = await readCommandsFromDir(
        join(installPath, 'commands'),
        source,
        pluginScope
      )
      results.push(...pluginCommands)

      const pluginSkills = await readSkillsFromDir(installPath, source, pluginScope)
      results.push(...pluginSkills)
    }
  }

  return results
}
