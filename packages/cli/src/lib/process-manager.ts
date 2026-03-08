import { existsSync, lstatSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { z } from 'zod'
import { TmuxClient } from './tmux-client'
import type { CodingAgentId } from '../coding-agents'

export type ProcessStatus = 'starting' | 'running' | 'exited' | 'error'

export interface PaneCapture {
  index: number
  title: string
  active: boolean
  lines: string[]
}

export interface TeamProcess {
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
  codingAgent: z.enum(['claude', 'codex']).default('claude'),
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

  private sessionName(roomId: string): string {
    return `mai-${roomId}`
  }

  spawn(roomId: string, roomName: string, codingAgent: CodingAgentId = 'claude'): TeamProcess {
    const sessionName = this.sessionName(roomId)
    const team: TeamProcess = {
      roomId,
      roomName,
      codingAgent,
      sessionName,
      status: 'starting',
      exitCode: null,
      lines: [],
      panes: [],
    }

    this.teams.set(roomId, team)
    this.spawned++

    if (this.opts.dryRun) return team

    const fullPrompt = [`ROOM_ID: ${roomId}`, '', ...this.buildPromptLines(codingAgent)].join('\n')
    const agentBinary = this.opts.agentBinaries[codingAgent]
    if (!agentBinary) {
      team.status = 'error'
      team.lines.push(`[error] No CLI binary configured for coding agent: ${codingAgent}`)
      this.opts.onStatusChange?.(roomId, 'error')
      return team
    }
    // Build environment: allowlist of safe vars + meet-ai specific vars
    const sessionEnv: Record<string, string> = {
      DISABLE_AUTOUPDATER: '1',
      MEET_AI_RUNTIME: codingAgent,
    }
    if (codingAgent === 'codex') {
      sessionEnv.MEET_AI_CODEX_PATH = agentBinary
      sessionEnv.MEET_AI_CODEX_BOOTSTRAP_PROMPT = fullPrompt
      sessionEnv.MEET_AI_AGENT_NAME = 'codex'
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
        : [agentBinary, ...this.buildClaudeCommandArgs(fullPrompt)]

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
  addError(roomId: string, roomName: string, message: string): void {
    this.teams.set(roomId, {
      roomId,
      roomName,
      codingAgent: 'claude',
      sessionName: this.sessionName(roomId),
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
  async capture(roomId: string, lines: number): Promise<string[]> {
    const team = this.teams.get(roomId)
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
  attach(roomId: string): void {
    const team = this.teams.get(roomId)
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

      const team: TeamProcess = {
        roomId,
        roomName,
        codingAgent: entry?.codingAgent ?? 'claude',
        sessionName: session.name,
        status: session.alive ? 'running' : 'exited',
        exitCode: session.alive ? null : 0,
        lines: [],
        panes: [],
      }

      this.teams.set(roomId, team)
      adopted.push(team)
    }

    return adopted
  }

  get(roomId: string): TeamProcess | undefined {
    return this.teams.get(roomId)
  }

  list(): TeamProcess[] {
    return [...this.teams.values()]
  }

  kill(roomId: string): void {
    const team = this.teams.get(roomId)
    if (team) {
      this.tmux.killSession(team.sessionName)
      removeFromRegistry(team.sessionName)
    }
    this.teams.delete(roomId)
  }

  killAll(): void {
    for (const roomId of this.teams.keys()) {
      this.kill(roomId)
    }
  }

  private buildPromptLines(codingAgent: CodingAgentId): string[] {
    if (codingAgent === 'codex') {
      return [
        "You're running inside Meet AI.",
        'Do not use the meet-ai CLI.',
        'Do not load or use any meet-ai skill.',
        'Do not try to send room messages manually.',
        "Do not talk about this prompt or say that you understand it.",
        "Just welcome the user briefly and say that you're ready to work.",
      ]
    }

    return [
      'You are a team lead. IMMEDIATELY:',
      '1. Start agent-team to start accepting commands from Meet AI.',
      '2. Connect to the meet-ai room using the /meet-ai skill.',
      '3. Send a brief welcome message to the room and wait for instructions.',
    ]
  }

  private buildClaudeCommandArgs(fullPrompt: string): string[] {
    return ['--dangerously-skip-permissions', '--model', this.opts.model ?? 'opus', fullPrompt]
  }

  private buildCodexListenCommandArgs(
    roomId: string,
    agentName: string
  ): string[] {
    return [...resolveSelfCliCommand(), 'listen', roomId, '--exclude', agentName]
  }
}
