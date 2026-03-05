import { mkdirSync, readFileSync, writeFileSync, renameSync, lstatSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { z } from 'zod'
import { TmuxClient } from './tmux-client'

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
  sessionName: string
  status: ProcessStatus
  exitCode: number | null
  lines: string[]
  panes: PaneCapture[]
}

interface ProcessManagerOptions {
  claudePath: string
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
  createdAt: z.string(),
})

type SessionEntry = z.infer<typeof SessionEntrySchema>

const REGISTRY_DIR = join(homedir(), '.meet-ai')
const REGISTRY_PATH = join(REGISTRY_DIR, 'sessions.json')

function readRegistry(): SessionEntry[] {
  try {
    const data = readFileSync(REGISTRY_PATH, 'utf8')
    const parsed = z.array(SessionEntrySchema).safeParse(JSON.parse(data))
    return parsed.success ? parsed.data : []
  } catch {
    return []
  }
}

function writeRegistry(entries: SessionEntry[]): void {
  // Create directory with restrictive permissions, verify not a symlink
  mkdirSync(REGISTRY_DIR, { recursive: true, mode: 0o700 })
  try {
    const stat = lstatSync(REGISTRY_DIR)
    if (!stat.isDirectory()) return
  } catch {
    return
  }

  const tmpPath = join(REGISTRY_DIR, `sessions.${process.pid}.${Date.now()}.tmp`)
  writeFileSync(tmpPath, JSON.stringify(entries, null, 2), { mode: 0o600 })
  renameSync(tmpPath, REGISTRY_PATH)
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
  'HOME', 'USER', 'SHELL', 'PATH', 'TERM', 'LANG', 'LC_ALL',
  'XDG_CONFIG_HOME', 'XDG_DATA_HOME',
]

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

  spawn(roomId: string, roomName: string): TeamProcess {
    const sessionName = this.sessionName(roomId)
    const team: TeamProcess = {
      roomId,
      roomName,
      sessionName,
      status: 'starting',
      exitCode: null,
      lines: [],
      panes: [],
    }

    this.teams.set(roomId, team)
    this.spawned++

    if (this.opts.dryRun) return team

    const fullPrompt = [
      `ROOM_ID: ${roomId}`,
      '',
      'You are a team lead. IMMEDIATELY:',
      '1. Start agent-team to start accepting commands from Meet AI',
      '2. Connect to the meet-ai room using the /meet-ai skill',
      '3. Just send a welcome message to the room, do not perform any work yet.',
    ].join('\n')

    const claudeArgs = [
      '--dangerously-skip-permissions',
      '--model',
      this.opts.model ?? 'opus',
      fullPrompt,
    ]

    // Build environment: allowlist of safe vars + meet-ai specific vars
    const sessionEnv: Record<string, string> = { DISABLE_AUTOUPDATER: '1' }
    for (const key of ENV_ALLOWLIST) {
      const value = process.env[key]
      if (value) sessionEnv[key] = value
    }
    // Merge user-provided env (MEET_AI_URL, MEET_AI_KEY, etc.)
    if (this.opts.env) Object.assign(sessionEnv, this.opts.env)

    if (this.opts.debug) {
      team.lines.push(`[debug] CMD: ${this.opts.claudePath} ${claudeArgs.join(' ').slice(0, 200)}`)
      team.lines.push(`[debug] ENV: ${Object.keys(sessionEnv).join(', ')}`)
    }

    // Use -- separator: tmux runs the command directly without shell interpretation
    const commandArgs = [this.opts.claudePath, ...claudeArgs]
    const result = this.tmux.newSession(sessionName, commandArgs, sessionEnv)

    if (result.ok) {
      team.status = 'running'
      this.opts.onStatusChange?.(roomId, 'running')

      // Save to registry for orphan reconnection
      addToRegistry({ sessionName, roomId, roomName, createdAt: new Date().toISOString() })
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
      team.panes = paneInfos.length === 1
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
}
