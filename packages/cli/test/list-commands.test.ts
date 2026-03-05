import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { mkdir, writeFile, mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { listCommands, type ListCommandsOptions } from '../src/commands/list-commands/usecase'

let tempDir: string

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'list-commands-'))
})

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true })
})

function opts(overrides: Partial<ListCommandsOptions> = {}): ListCommandsOptions {
  return {
    projectPath: tempDir,
    _userClaudeDir: join(tempDir, 'user-claude'),
    _pluginsFile: join(tempDir, 'installed_plugins.json'),
    ...overrides,
  }
}

describe('built-in commands', () => {
  test('always returns built-in commands', async () => {
    const result = await listCommands(opts())
    const builtins = result.filter(c => c.source === 'built-in')
    expect(builtins.length).toBeGreaterThan(0)
    const names = builtins.map(c => c.name)
    expect(names).toContain('help')
    expect(names).toContain('model')
    expect(names).toContain('clear')
  })

  test('built-in commands have correct shape', async () => {
    const result = await listCommands(opts())
    const builtins = result.filter(c => c.source === 'built-in')
    for (const cmd of builtins) {
      expect(cmd.type).toBe('command')
      expect(cmd.scope).toBe('user')
      expect(typeof cmd.name).toBe('string')
      expect(typeof cmd.description).toBe('string')
    }
  })
})

describe('standalone skills (user)', () => {
  test('discovers user-level standalone skills', async () => {
    const userClaudeDir = join(tempDir, 'user-claude')
    const skillDir = join(userClaudeDir, 'skills', 'my-skill')
    await mkdir(skillDir, { recursive: true })
    await writeFile(
      join(skillDir, 'SKILL.md'),
      '---\nname: my-skill\ndescription: My test skill\n---\n\n# My Skill\n'
    )

    const result = await listCommands(opts({ _userClaudeDir: userClaudeDir }))
    const skill = result.find(c => c.name === 'my-skill')
    expect(skill).toBeDefined()
    expect(skill?.type).toBe('skill')
    expect(skill?.source).toBe('standalone')
    expect(skill?.scope).toBe('user')
    expect(skill?.description).toBe('My test skill')
  })

  test('skips user skill dirs without SKILL.md', async () => {
    const userClaudeDir = join(tempDir, 'user-claude')
    await mkdir(join(userClaudeDir, 'skills', 'empty-skill'), { recursive: true })

    const result = await listCommands(opts({ _userClaudeDir: userClaudeDir }))
    const skill = result.find(c => c.name === 'empty-skill')
    expect(skill).toBeUndefined()
  })
})

describe('standalone skills (project)', () => {
  test('discovers project-level standalone skills', async () => {
    const projectSkillDir = join(tempDir, '.claude', 'skills', 'proj-skill')
    await mkdir(projectSkillDir, { recursive: true })
    await writeFile(
      join(projectSkillDir, 'SKILL.md'),
      '---\nname: proj-skill\ndescription: Project skill\n---\n'
    )

    const result = await listCommands(opts())
    const skill = result.find(c => c.name === 'proj-skill')
    expect(skill).toBeDefined()
    expect(skill?.scope).toBe('project')
    expect(skill?.source).toBe('standalone')
  })

  test('project skills are scoped to project', async () => {
    const projectSkillDir = join(tempDir, '.claude', 'skills', 'scoped-skill')
    await mkdir(projectSkillDir, { recursive: true })
    await writeFile(
      join(projectSkillDir, 'SKILL.md'),
      '---\nname: scoped-skill\ndescription: Scoped skill\n---\n'
    )

    const result = await listCommands(opts())
    const skill = result.find(c => c.name === 'scoped-skill')
    expect(skill?.scope).toBe('project')
  })
})

describe('plugin commands and skills', () => {
  async function setupPlugin(opts: {
    pluginScopeName: string
    installPath: string
    pluginsFile: string
    userSettingsPath: string
    commands?: Array<{ filename: string; content: string; subdir?: string }>
    skills?: Array<{ name: string; content: string }>
  }) {
    // Write installed_plugins.json
    const plugins: Record<string, unknown[]> = {
      [opts.pluginScopeName]: [
        {
          scope: 'user',
          installPath: opts.installPath,
          version: '1.0.0',
        },
      ],
    }
    await writeFile(opts.pluginsFile, JSON.stringify({ version: 2, plugins }))

    // Write user settings.json with enabledPlugins
    const settingsDir = join(opts.userSettingsPath, '..')
    await mkdir(settingsDir, { recursive: true })
    await writeFile(
      opts.userSettingsPath,
      JSON.stringify({ enabledPlugins: { [opts.pluginScopeName]: true } })
    )

    // Write command files
    if (opts.commands) {
      for (const cmd of opts.commands) {
        const dir = cmd.subdir
          ? join(opts.installPath, 'commands', cmd.subdir)
          : join(opts.installPath, 'commands')
        await mkdir(dir, { recursive: true })
        await writeFile(join(dir, cmd.filename), cmd.content)
      }
    }

    // Write skill files
    if (opts.skills) {
      for (const skill of opts.skills) {
        const skillDir = join(opts.installPath, 'skills', skill.name)
        await mkdir(skillDir, { recursive: true })
        await writeFile(join(skillDir, 'SKILL.md'), skill.content)
      }
    }
  }

  test('discovers plugin commands', async () => {
    const installPath = join(tempDir, 'plugin-install')
    const pluginsFile = join(tempDir, 'installed_plugins.json')
    const userClaudeDir = join(tempDir, 'user-claude')
    const userSettingsPath = join(userClaudeDir, 'settings.json')

    await setupPlugin({
      pluginScopeName: 'test-plugin@test-marketplace',
      installPath,
      pluginsFile,
      userSettingsPath,
      commands: [
        {
          filename: 'my-cmd.md',
          content: '---\nname: my-cmd\ndescription: My command\n---\n',
        },
      ],
    })

    const result = await listCommands(
      opts({ _userClaudeDir: userClaudeDir, _pluginsFile: pluginsFile })
    )
    const cmd = result.find(c => c.name === 'my-cmd')
    expect(cmd).toBeDefined()
    expect(cmd?.type).toBe('command')
    expect(cmd?.source).toBe('plugin:test-plugin@test-marketplace')
    expect(cmd?.scope).toBe('user')
  })

  test('discovers plugin skills', async () => {
    const installPath = join(tempDir, 'plugin-install')
    const pluginsFile = join(tempDir, 'installed_plugins.json')
    const userClaudeDir = join(tempDir, 'user-claude')
    const userSettingsPath = join(userClaudeDir, 'settings.json')

    await setupPlugin({
      pluginScopeName: 'test-plugin@test-marketplace',
      installPath,
      pluginsFile,
      userSettingsPath,
      skills: [
        {
          name: 'my-skill',
          content: '---\nname: my-skill\ndescription: My plugin skill\n---\n',
        },
      ],
    })

    const result = await listCommands(
      opts({ _userClaudeDir: userClaudeDir, _pluginsFile: pluginsFile })
    )
    const skill = result.find(c => c.name === 'my-skill')
    expect(skill).toBeDefined()
    expect(skill?.type).toBe('skill')
    expect(skill?.source).toBe('plugin:test-plugin@test-marketplace')
  })

  test('discovers commands in subdirectories', async () => {
    const installPath = join(tempDir, 'plugin-install')
    const pluginsFile = join(tempDir, 'installed_plugins.json')
    const userClaudeDir = join(tempDir, 'user-claude')
    const userSettingsPath = join(userClaudeDir, 'settings.json')

    await setupPlugin({
      pluginScopeName: 'test-plugin@test-marketplace',
      installPath,
      pluginsFile,
      userSettingsPath,
      commands: [
        {
          filename: 'plan.md',
          subdir: 'ce',
          content: '---\nname: ce:plan\ndescription: Create a plan\n---\n',
        },
      ],
    })

    const result = await listCommands(
      opts({ _userClaudeDir: userClaudeDir, _pluginsFile: pluginsFile })
    )
    const cmd = result.find(c => c.name === 'ce:plan')
    expect(cmd).toBeDefined()
    expect(cmd?.type).toBe('command')
  })

  test('skips disabled plugins', async () => {
    const installPath = join(tempDir, 'plugin-install')
    const pluginsFile = join(tempDir, 'installed_plugins.json')
    const userClaudeDir = join(tempDir, 'user-claude')

    // Write installed_plugins.json with a plugin
    const plugins = {
      'disabled-plugin@test-marketplace': [
        { scope: 'user', installPath, version: '1.0.0' },
      ],
    }
    await writeFile(pluginsFile, JSON.stringify({ version: 2, plugins }))

    // User settings does NOT enable this plugin
    await mkdir(userClaudeDir, { recursive: true })
    await writeFile(
      join(userClaudeDir, 'settings.json'),
      JSON.stringify({ enabledPlugins: {} })
    )

    // Write a command file anyway
    const cmdDir = join(installPath, 'commands')
    await mkdir(cmdDir, { recursive: true })
    await writeFile(join(cmdDir, 'hidden.md'), '---\nname: hidden\ndescription: Should not appear\n---\n')

    const result = await listCommands(
      opts({ _userClaudeDir: userClaudeDir, _pluginsFile: pluginsFile })
    )
    const cmd = result.find(c => c.name === 'hidden')
    expect(cmd).toBeUndefined()
  })

  test('merges user and project enabled plugins', async () => {
    const installPath1 = join(tempDir, 'plugin1')
    const installPath2 = join(tempDir, 'plugin2')
    const pluginsFile = join(tempDir, 'installed_plugins.json')
    const userClaudeDir = join(tempDir, 'user-claude')

    // Two plugins installed
    const plugins = {
      'user-plugin@marketplace': [{ scope: 'user', installPath: installPath1, version: '1.0.0' }],
      'proj-plugin@marketplace': [{ scope: 'project', installPath: installPath2, version: '1.0.0' }],
    }
    await writeFile(pluginsFile, JSON.stringify({ version: 2, plugins }))

    // User settings enables user-plugin
    await mkdir(userClaudeDir, { recursive: true })
    await writeFile(
      join(userClaudeDir, 'settings.json'),
      JSON.stringify({ enabledPlugins: { 'user-plugin@marketplace': true } })
    )

    // Project settings enables proj-plugin
    const projectClaudeDir = join(tempDir, '.claude')
    await mkdir(projectClaudeDir, { recursive: true })
    await writeFile(
      join(projectClaudeDir, 'settings.json'),
      JSON.stringify({ enabledPlugins: { 'proj-plugin@marketplace': true } })
    )

    // Write commands for each
    await mkdir(join(installPath1, 'commands'), { recursive: true })
    await writeFile(
      join(installPath1, 'commands', 'user-cmd.md'),
      '---\nname: user-cmd\ndescription: User plugin cmd\n---\n'
    )
    await mkdir(join(installPath2, 'commands'), { recursive: true })
    await writeFile(
      join(installPath2, 'commands', 'proj-cmd.md'),
      '---\nname: proj-cmd\ndescription: Project plugin cmd\n---\n'
    )

    const result = await listCommands(
      opts({ _userClaudeDir: userClaudeDir, _pluginsFile: pluginsFile })
    )
    expect(result.find(c => c.name === 'user-cmd')).toBeDefined()
    expect(result.find(c => c.name === 'proj-cmd')).toBeDefined()
  })
})

describe('missing directories', () => {
  test('handles missing user skills dir gracefully', async () => {
    const result = await listCommands(
      opts({ _userClaudeDir: join(tempDir, 'nonexistent') })
    )
    const builtins = result.filter(c => c.source === 'built-in')
    expect(builtins.length).toBeGreaterThan(0)
  })

  test('handles missing project .claude dir gracefully', async () => {
    const result = await listCommands(
      opts({ projectPath: join(tempDir, 'no-project') })
    )
    const builtins = result.filter(c => c.source === 'built-in')
    expect(builtins.length).toBeGreaterThan(0)
  })

  test('handles missing plugins file gracefully', async () => {
    const result = await listCommands(
      opts({ _pluginsFile: join(tempDir, 'no-plugins.json') })
    )
    const builtins = result.filter(c => c.source === 'built-in')
    expect(builtins.length).toBeGreaterThan(0)
  })
})

describe('YAML frontmatter parsing', () => {
  test('skips files with no frontmatter', async () => {
    const userClaudeDir = join(tempDir, 'user-claude')
    const skillDir = join(userClaudeDir, 'skills', 'no-frontmatter')
    await mkdir(skillDir, { recursive: true })
    await writeFile(join(skillDir, 'SKILL.md'), '# Just a heading\nNo frontmatter here.')

    const result = await listCommands(opts({ _userClaudeDir: userClaudeDir }))
    const skill = result.find(c => c.name === 'no-frontmatter')
    expect(skill).toBeUndefined()
  })

  test('uses directory name as fallback when name missing from frontmatter', async () => {
    const userClaudeDir = join(tempDir, 'user-claude')
    const skillDir = join(userClaudeDir, 'skills', 'fallback-skill')
    await mkdir(skillDir, { recursive: true })
    await writeFile(
      join(skillDir, 'SKILL.md'),
      '---\ndescription: Only description, no name\n---\n'
    )

    const result = await listCommands(opts({ _userClaudeDir: userClaudeDir }))
    const skill = result.find(c => c.name === 'fallback-skill')
    expect(skill).toBeDefined()
    expect(skill?.description).toBe('Only description, no name')
  })
})

describe('output structure', () => {
  test('all entries have required fields', async () => {
    const result = await listCommands(opts())
    for (const entry of result) {
      expect(typeof entry.name).toBe('string')
      expect(entry.name.length).toBeGreaterThan(0)
      expect(typeof entry.description).toBe('string')
      expect(['command', 'skill']).toContain(entry.type)
      expect(['user', 'project']).toContain(entry.scope)
    }
  })

  test('no duplicate built-in commands', async () => {
    const result = await listCommands(opts())
    const builtins = result.filter(c => c.source === 'built-in')
    const names = builtins.map(c => c.name)
    const unique = new Set(names)
    expect(names.length).toBe(unique.size)
  })
})
