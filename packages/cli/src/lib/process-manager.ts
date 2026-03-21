import { existsSync, lstatSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { TmuxClient } from './tmux-client'
import type { CodingAgentId } from '../coding-agents'
import { buildClaudeSystemPrompt } from './prompts/claude-system-prompt'
import { buildClaudeStartingPrompt } from './prompts/claude-starting-prompt'
import { buildCodexBootstrapPrompt } from './prompts/codex-bootstrap-prompt'
import { buildPiStartingPrompt } from './prompts/pi-starting-prompt'
import { buildOpencodeStartingPrompt } from './prompts/opencode-starting-prompt'

export type ProcessStatus = 'starting' | 'running' | 'exited' | 'error'

export interface PaneCapture {
  index: number
  title: string
  active: boolean
  lines: string[]
}

export interface TeamProcess {
  teamId: string
  roomId: string
  roomName: string
  codingAgent: CodingAgentId
  sessionName: string
  status: ProcessStatus
  exitCode: number | null
  lines: string[]
  panes: PaneCapture[]
}

interface ProcessManagerOptions {
  agentBinaries: Partial<Record<CodingAgentId, string>>
  model?: string
  dryRun?: boolean
  debug?: boolean
  env?: Record<string, string>
  onStatusChange?: (roomId: string, status: ProcessStatus, exitCode?: number | null) => void
  tmux?: TmuxClient // injectable for testing
}

// ── Session Registry (inlined) ──

const SessionEntrySchema = z.object({
  sessionName: z.string(),
  roomId: z.string(),
  roomName: z.string(),
  codingAgent: z.enum(['claude', 'codex', 'pi', 'opencode']).default('claude'),
  createdAt: z.string(),
})

type SessionEntry = z.infer<typeof SessionEntrySchema>

function getRegistryDir(): string {
  return join(process.env.HOME ?? homedir(), '.meet-ai')
}

function getRegistryPath(): string {
  return join(getRegistryDir(), 'sessions.json')
}

function readRegistry(): SessionEntry[] {
  try {
    const data = readFileSync(getRegistryPath(), 'utf8')
    const parsed = z.array(SessionEntrySchema).safeParse(JSON.parse(data))
    return parsed.success ? parsed.data : []
  } catch {
    return []
  }
}

function writeRegistry(entries: SessionEntry[]): void {
  const registryDir = getRegistryDir()
  // Create directory with restrictive permissions, verify not a symlink
  mkdirSync(registryDir, { recursive: true, mode: 0o700 })
  try {
    const stat = lstatSync(registryDir)
    if (!stat.isDirectory()) return
  } catch {
    return
  }

  const tmpPath = join(registryDir, `sessions.${process.pid}.${Date.now()}.tmp`)
  writeFileSync(tmpPath, JSON.stringify(entries, null, 2), { mode: 0o600 })
  renameSync(tmpPath, getRegistryPath())
}

function addToRegistry(entry: SessionEntry): void {
  const entries = readRegistry()
  // Replace if session name already exists
  const idx = entries.findIndex(e => e.sessionName === entry.sessionName)
  if (idx !== -1) entries[idx] = entry
  else entries.push(entry)
  writeRegistry(entries)
}

function removeFromRegistry(sessionName: string): void {
  const entries = readRegistry().filter(e => e.sessionName !== sessionName)
  writeRegistry(entries)
}

/** Allowed env vars to pass to tmux sessions (security: allowlist, not denylist). */
const ENV_ALLOWLIST = [
  'HOME',
  'USER',
  'SHELL',
  'PATH',
  'TERM',
  'LANG',
  'LC_ALL',
  'XDG_CONFIG_HOME',
  'XDG_DATA_HOME',
  'CODEX_HOME',
  'MEET_AI_CODEX_STATE_DIR',
]

function resolveSelfCliCommand(): string[] {
  const sourceEntry = fileURLToPath(new URL('../index.ts', import.meta.url))
  if (existsSync(sourceEntry) && typeof Bun !== 'undefined') {
    return [process.execPath, 'run', sourceEntry]
  }

  const builtEntry = fileURLToPath(new URL('../index.js', import.meta.url))
  if (existsSync(builtEntry)) {
    return [process.execPath, builtEntry]
  }

  return ['meet-ai']
}

export class ProcessManager {
  private teams = new Map<string, TeamProcess>()
  private tmux: TmuxClient
  private opts: ProcessManagerOptions

  /** Number of sessions spawned in this CLI instance. */
  spawned = 0

  constructor(opts: ProcessManagerOptions) {
    this.opts = opts
    this.tmux = opts.tmux ?? new TmuxClient({ server: 'meet-ai', scrollback: 10_000 })
  }

  private sessionName(teamId: string): string {
    return `mai-${teamId}`
  }

  private nextTeamId(roomId: string): string {
    if (!this.teams.has(roomId)) return roomId
    let suffix = 2
    while (this.teams.has(`${roomId}-${suffix}`)) suffix++
    return `${roomId}-${suffix}`
  }

  spawn(roomId: string, roomName: string, codingAgent: CodingAgentId = 'claude'): TeamProcess {
    const teamId = this.nextTeamId(roomId)
    const sessionName = this.sessionName(teamId)
    const team: TeamProcess = {
      teamId,
      roomId,
      roomName,
      codingAgent,
      sessionName,
      status: 'starting',
      exitCode: null,
      lines: [],
      panes: [],
    }

    this.teams.set(teamId, team)
    this.spawned++

    if (this.opts.dryRun) return team

    const fullPrompt = [`ROOM_ID: ${roomId}`, '', ...this.buildPromptLines(codingAgent, roomId)].join('\n')
    const agentBinary = this.opts.agentBinaries[codingAgent]
    if (!agentBinary) {
      team.status = 'error'
      team.lines.push(`[error] No CLI binary configured for coding agent: ${codingAgent}`)
      this.opts.onStatusChange?.(roomId, 'error')
      return team
    }
    // Build environment: allowlist of safe vars + meet-ai specific vars
    const sessionEnv: Record<string, string> = { MEET_AI_RUNTIME: codingAgent }
    if (codingAgent === 'claude') {
      sessionEnv.DISABLE_AUTOUPDATER = '1'
      sessionEnv.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = '1'
    }

    if (codingAgent === 'codex') {
      sessionEnv.MEET_AI_CODEX_PATH = agentBinary
      sessionEnv.MEET_AI_CODEX_BOOTSTRAP_PROMPT = fullPrompt
      sessionEnv.MEET_AI_AGENT_NAME = 'codex'
    }

    if (codingAgent === 'pi') {
      sessionEnv.MEET_AI_RUNTIME = 'pi'
      sessionEnv.MEET_AI_PI_PATH = agentBinary
      sessionEnv.MEET_AI_PI_BOOTSTRAP_PROMPT = fullPrompt
      sessionEnv.MEET_AI_AGENT_NAME = 'pi'
      sessionEnv.MEET_AI_ROOM_ID = roomId
    }

    if (codingAgent === 'opencode') {
      sessionEnv.MEET_AI_RUNTIME = 'opencode'
      sessionEnv.MEET_AI_OPENCODE_PATH = agentBinary
      sessionEnv.MEET_AI_OPENCODE_BOOTSTRAP_PROMPT = fullPrompt
      sessionEnv.MEET_AI_AGENT_NAME = 'opencode'
      sessionEnv.MEET_AI_ROOM_ID = roomId
    }
    for (const key of ENV_ALLOWLIST) {
      const value = process.env[key]
      if (value) sessionEnv[key] = value
    }
    // Merge user-provided env (MEET_AI_URL, MEET_AI_KEY, etc.)
    if (this.opts.env) Object.assign(sessionEnv, this.opts.env)

    const commandArgs =
      codingAgent === 'codex'
        ? this.buildCodexListenCommandArgs(roomId, sessionEnv.MEET_AI_AGENT_NAME ?? 'codex')
        : codingAgent === 'pi'
          ? this.buildPiListenCommandArgs(roomId, sessionEnv.MEET_AI_AGENT_NAME ?? 'pi')
          : codingAgent === 'opencode'
            ? this.buildOpencodeListenCommandArgs(roomId, sessionEnv.MEET_AI_AGENT_NAME ?? 'opencode')
            : [agentBinary, ...this.buildClaudeCommandArgs(roomId, fullPrompt)]

    if (this.opts.debug) {
      team.lines.push(`[debug] AGENT: ${codingAgent}`)
      team.lines.push(`[debug] CMD: ${commandArgs.join(' ').slice(0, 200)}`)
      team.lines.push(`[debug] ENV: ${Object.keys(sessionEnv).join(', ')}`)
    }

    // Use -- separator: tmux runs the command directly without shell interpretation
    const result = this.tmux.newSession(sessionName, commandArgs, sessionEnv)

    if (result.ok) {
      team.status = 'running'
      this.opts.onStatusChange?.(roomId, 'running')

      // Save to registry for orphan reconnection
      addToRegistry({
        sessionName,
        roomId,
        roomName,
        codingAgent,
        createdAt: new Date().toISOString(),
      })
    } else {
      team.status = 'error'
      team.lines.push(`[error] tmux: ${result.error}`)
      this.opts.onStatusChange?.(roomId, 'error')
    }

    return team
  }

  /** Add an error entry so the TUI can display spawn failures. */
  addError(errorId: string, roomName: string, message: string): void {
    const teamId = this.nextTeamId(errorId)
    this.teams.set(teamId, {
      teamId,
      roomId: errorId,
      roomName,
      codingAgent: 'claude',
      sessionName: this.sessionName(teamId),
      status: 'error',
      exitCode: null,
      lines: [`[error] ${message}`],
      panes: [],
    })
  }

  /**
   * Capture all pane content for a session (async — non-blocking).
   * Discovers panes via listPanes, captures each in parallel.
   * Updates team.panes and team.lines (first pane for backward compat).
   */
  async capture(teamId: string, lines: number): Promise<string[]> {
    const team = this.teams.get(teamId)
    if (!team) return []

    const paneInfos = this.tmux.listPanes(team.sessionName)

    // Single pane or no panes discovered — fast path
    if (paneInfos.length <= 1) {
      const captured = await this.tmux.capturePane(team.sessionName, lines)
      if (captured.length === 0) return team.lines
      team.lines = captured
      team.panes =
        paneInfos.length === 1
          ? [{ index: 0, title: paneInfos[0]!.title, active: true, lines: captured }]
          : []
      return captured
    }

    // Multiple panes — capture each in parallel
    const captures = await Promise.all(
      paneInfos.map(async pane => ({
        index: pane.index,
        title: pane.title,
        active: pane.active,
        lines: await this.tmux.capturePane(`${team.sessionName}.${pane.index}`, lines),
      }))
    )

    team.panes = captures
    // Keep first pane as team.lines for backward compat
    const firstPane = captures[0]
    if (firstPane && firstPane.lines.length > 0) {
      team.lines = firstPane.lines
    }

    return team.lines
  }

  /** Refresh status of all sessions using a single listSessions call. */
  refreshStatuses(): void {
    const sessions = this.tmux.listSessions()
    const sessionMap = new Map(sessions.map(s => [s.name, s]))

    for (const team of this.teams.values()) {
      if (team.status !== 'running' && team.status !== 'starting') continue

      const info = sessionMap.get(team.sessionName)
      if (!info) {
        // Session no longer exists
        team.status = 'exited'
        team.exitCode = null
        this.opts.onStatusChange?.(team.roomId, 'exited')
      } else if (!info.alive && team.status === 'running') {
        team.status = 'exited'
        team.exitCode = 0
        this.opts.onStatusChange?.(team.roomId, 'exited', 0)
      }
    }
  }

  /** Attach to a session interactively (blocks until detach). */
  attach(teamId: string): void {
    const team = this.teams.get(teamId)
    if (!team) return
    this.tmux.attachSession(team.sessionName)
  }

  /** Find and adopt orphaned tmux sessions from a previous CLI run. */
  reconnect(): TeamProcess[] {
    const sessions = this.tmux.listSessions()
    const registry = readRegistry()
    const registryMap = new Map(registry.map(e => [e.sessionName, e]))
    const adopted: TeamProcess[] = []

    for (const session of sessions) {
      // Only adopt sessions with our prefix
      if (!session.name.startsWith('mai-')) continue
      // Skip sessions we already track
      if ([...this.teams.values()].some(t => t.sessionName === session.name)) continue

      const entry = registryMap.get(session.name)
      const roomId = entry?.roomId ?? session.name.replace('mai-', '')
      const roomName = entry?.roomName ?? session.name
      // Derive teamId from session name (already unique across tmux)
      const teamId = session.name.replace('mai-', '')

      const team: TeamProcess = {
        teamId,
        roomId,
        roomName,
        codingAgent: entry?.codingAgent ?? 'claude',
        sessionName: session.name,
        status: session.alive ? 'running' : 'exited',
        exitCode: session.alive ? null : 0,
        lines: [],
        panes: [],
      }

      this.teams.set(teamId, team)
      adopted.push(team)
    }

    return adopted
  }

  get(teamId: string): TeamProcess | undefined {
    return this.teams.get(teamId)
  }

  list(): TeamProcess[] {
    return [...this.teams.values()]
  }

  kill(teamId: string): void {
    const team = this.teams.get(teamId)
    if (team) {
      this.tmux.killSession(team.sessionName)
      removeFromRegistry(team.sessionName)
    }
    this.teams.delete(teamId)
  }

  killAll(): void {
    for (const teamId of this.teams.keys()) {
      this.kill(teamId)
    }
  }

  private buildPromptLines(codingAgent: CodingAgentId, roomId: string): string[] {
    if (codingAgent === 'codex') {
      return buildCodexBootstrapPrompt()
    }

    if (codingAgent === 'pi') {
      return buildPiStartingPrompt(roomId)
    }

    if (codingAgent === 'opencode') {
      return buildOpencodeStartingPrompt(roomId)
    }

    return buildClaudeStartingPrompt(roomId)
  }

  private buildClaudeAppendSystemPrompt(roomId: string): string {
    return buildClaudeSystemPrompt(roomId)
  }

  private buildClaudeCommandArgs(roomId: string, fullPrompt: string): string[] {
    return [
      '--dangerously-skip-permissions',
      '--model',
      this.opts.model ?? 'opus',
      '--append-system-prompt',
      this.buildClaudeAppendSystemPrompt(roomId),
      fullPrompt,
    ]
  }

  private buildCodexListenCommandArgs(roomId: string, agentName: string): string[] {
    return [...resolveSelfCliCommand(), 'listen', roomId, '--exclude', agentName]
  }

  private buildPiListenCommandArgs(roomId: string, agentName: string): string[] {
    return [...resolveSelfCliCommand(), 'listen', roomId, '--exclude', agentName]
  }

  private buildOpencodeListenCommandArgs(roomId: string, agentName: string): string[] {
    return [...resolveSelfCliCommand(), 'listen', roomId, '--exclude', agentName]
  }
}
