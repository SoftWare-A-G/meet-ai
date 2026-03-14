import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir, platform } from 'node:os'
import { join } from 'node:path'
import type { CodingAgentId } from './coding-agents'

/**
 * Find Claude Code CLI installation
 */
function findBinary(binaryName: string, envVarName: string, commonPaths: string[]): string {
  try {
    const command = platform() === 'win32' ? `where ${binaryName}` : `which ${binaryName}`
    const result = execSync(command, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim()
    const binaryPath = result.split('\n')[0].trim()
    if (binaryPath && existsSync(binaryPath)) {
      return binaryPath
    }
  } catch {
    // Continue to other methods
  }

  const envPath = process.env[envVarName]
  if (envPath && existsSync(envPath)) {
    return envPath
  }

  for (const path of commonPaths) {
    if (existsSync(path)) {
      return path
    }
  }

  throw new Error(
    `${binaryName} is not installed`
  )
}

export function findClaudeCli(): string {
  const home = homedir()
  try {
    return findBinary('claude', 'MEET_AI_CLAUDE_PATH', [
      join(home, '.bun', 'bin', 'claude'),
      '/opt/homebrew/bin/claude',
      '/usr/local/bin/claude',
      join(home, '.local', 'bin', 'claude'),
    ])
  } catch {
    throw new Error(
      `
Claude Code is not installed

Please install Claude Code:
  bun add -g @anthropic-ai/claude-code

Or set MEET_AI_CLAUDE_PATH to the Claude Code CLI path.
      `.trim()
    )
  }
}

export function findCodexCli(): string {
  const home = homedir()
  try {
    return findBinary('codex', 'MEET_AI_CODEX_PATH', [
      join(home, '.bun', 'bin', 'codex'),
      '/opt/homebrew/bin/codex',
      '/usr/local/bin/codex',
      join(home, '.local', 'bin', 'codex'),
    ])
  } catch {
    throw new Error(
      `
Codex CLI is not installed

Please install Codex:
  npm install -g @openai/codex

Or set MEET_AI_CODEX_PATH to the Codex CLI path.
      `.trim()
    )
  }
}

export function findPiCli(): string {
  const home = homedir()
  try {
    return findBinary('pi', 'MEET_AI_PI_PATH', [
      join(home, '.bun', 'bin', 'pi'),
      '/opt/homebrew/bin/pi',
      '/usr/local/bin/pi',
      join(home, '.local', 'bin', 'pi'),
    ])
  } catch {
    throw new Error(
      `
Pi CLI is not installed

Please install Pi or set MEET_AI_PI_PATH to the Pi CLI path.
      `.trim()
    )
  }
}

export function findCodingAgentCli(agentId: CodingAgentId): string {
  if (agentId === 'codex') return findCodexCli()
  if (agentId === 'pi') return findPiCli()
  return findClaudeCli()
}
