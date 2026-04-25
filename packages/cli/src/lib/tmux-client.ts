import { execFileSync, execFile as execFileCb } from 'node:child_process'

/** Discriminated union result type for tmux command outcomes. */
export type TmuxResult =
  | { ok: true; output: string }
  | { ok: false; error: string }

export interface TmuxSessionInfo {
  name: string
  activity: number // unix timestamp of last activity
  alive: boolean // whether the pane command is still running
}

export interface TmuxPaneInfo {
  index: number
  title: string
  active: boolean
}

interface TmuxClientOptions {
  server: string // named server (e.g. 'meet-ai')
  scrollback: number // history-limit per session
}

const SESSION_NAME_RE = /^[a-zA-Z0-9_-]+$/

/** Validates tmux session name — only alphanumeric, hyphens, underscores. */
function validateSessionName(name: string): void {
  if (!SESSION_NAME_RE.test(name) || name.length > 256) {
    throw new Error(`Invalid tmux session name: ${name}`)
  }
}

/** Parse tmux version string like "tmux 3.4" -> [3, 4]. */
export function parseVersion(version: string | null): [number, number] {
  if (!version) return [0, 0]
  const match = version.match(/(\d+)\.(\d+)/)
  if (!match) return [0, 0]
  return [Number(match[1]), Number(match[2])]
}

/**
 * Parse one line of `tmux list-panes -F '#{pane_index}\t#{pane_title}\t#{pane_active}'` output.
 * Returns null when pane_index isn't a finite number — happens with very old tmux that echoes
 * unsupported format tokens literally, or when a pane title contains a tab and shifts columns.
 */
export function parsePaneListLine(line: string): TmuxPaneInfo | null {
  const [index, title, active] = line.split('\t')
  const parsedIndex = Number(index)
  if (!Number.isFinite(parsedIndex)) return null
  return {
    index: parsedIndex,
    title: title ?? '',
    active: active === '1',
  }
}

export class TmuxClient {
  private server: string
  private scrollback: number
  private droppedPaneRows = new Set<string>()

  constructor(opts: TmuxClientOptions) {
    this.server = opts.server
    this.scrollback = opts.scrollback
  }

  // ── Lifecycle ──

  /** Check if tmux is installed and return its version. */
  checkAvailability(): { available: boolean; version: string | null; error?: string } {
    try {
      // execFileSync does NOT use a shell — safe from injection
      const result = execFileSync('tmux', ['-V'], {
        encoding: 'utf8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim()
      if (!result) {
        return { available: false, version: null, error: 'tmux returned an empty version string' }
      }
      return { available: true, version: result }
    } catch (error) {
      return {
        available: false,
        version: null,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  /**
   * Create a new tmux session with the given command args.
   * Uses `--` separator to pass command directly without shell interpretation.
   */
  newSession(name: string, commandArgs: string[], env?: Record<string, string>): TmuxResult {
    validateSessionName(name)

    const envArgs = env
      ? ['env', ...Object.entries(env).map(([key, value]) => `${key}=${value}`)]
      : []

    const args = [
      '-L', this.server,
      'new-session',
      '-d',
      '-s', name,
      '-x', '120',
      '-y', '40',
      '--',
      ...envArgs,
      ...commandArgs,
    ]

    const result = this.exec(args)

    if (!result.ok) return result

    // Configure session: remain-on-exit and history-limit
    this.exec(['-L', this.server, 'set-option', '-t', name, 'remain-on-exit', 'on'])
    this.exec(['-L', this.server, 'set-option', '-t', name, 'history-limit', String(this.scrollback)])

    return result
  }

  /** Kill a specific tmux session. */
  killSession(name: string): TmuxResult {
    validateSessionName(name)
    return this.exec(['-L', this.server, 'kill-session', '-t', name])
  }

  /** List all sessions on the named server. */
  listSessions(): TmuxSessionInfo[] {
    const result = this.exec([
      '-L', this.server,
      'list-sessions',
      '-F', '#{session_name}\t#{session_activity}\t#{pane_dead}',
    ])

    // "no server running" is normal (no sessions) — return empty array
    if (!result.ok) return []

    return result.output
      .trim()
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        const [name, activity, dead] = line.split('\t')
        return {
          name: name ?? '',
          activity: Number(activity) || 0,
          alive: dead !== '1',
        }
      })
  }

  /** List all panes across all sessions with pane IDs and session names (async — does not block event loop). */
  listAllPanes(): Promise<{ paneId: string; sessionName: string; title: string; command: string }[]> {
    const args = [
      '-L', this.server,
      'list-panes', '-a',
      '-F', '#{pane_id}\t#{session_name}\t#{pane_title}\t#{pane_current_command}',
    ]
    return new Promise(resolve => {
      execFileCb('tmux', args, { encoding: 'utf8', timeout: 5000 }, (error, stdout) => {
        if (error) {
          resolve([])
          return
        }
        resolve(
          stdout
            .trim()
            .split('\n')
            .filter(line => line.trim())
            .map(line => {
              const [paneId, sessionName, title, command] = line.split('\t')
              return { paneId: paneId ?? '', sessionName: sessionName ?? '', title: title ?? '', command: command ?? '' }
            })
        )
      })
    })
  }

  /** List all panes in a session. */
  listPanes(sessionName: string): TmuxPaneInfo[] {
    validateSessionName(sessionName)
    const result = this.exec([
      '-L', this.server,
      'list-panes',
      '-t', sessionName,
      '-F', '#{pane_index}\t#{pane_title}\t#{pane_active}',
    ])

    if (!result.ok) return []

    const panes: TmuxPaneInfo[] = []
    for (const line of result.output.trim().split('\n')) {
      if (!line.trim()) continue
      const parsed = parsePaneListLine(line)
      if (!parsed) {
        this.warnDroppedPaneRow(sessionName, line)
        continue
      }
      panes.push(parsed)
    }
    return panes
  }

  private warnDroppedPaneRow(sessionName: string, rawLine: string): void {
    const key = `${sessionName} ${rawLine}`
    if (this.droppedPaneRows.has(key)) return
    this.droppedPaneRows.add(key)
    console.warn(
      `[meet-ai] tmux list-panes returned a malformed row for session "${sessionName}" — dropping. ` +
        `raw=${JSON.stringify(rawLine)}`
    )
  }

  // ── I/O ──

  /**
   * Capture pane content (async — does not block event loop).
   * Target can be "session" or "session.paneIndex" for multi-pane capture.
   * Returns the last `lines` lines of the pane with ANSI colors preserved.
   * Uses execFile (not exec) — no shell, safe from injection.
   */
  capturePane(target: string, lines: number): Promise<string[]> {
    // Allow tmux pane IDs like "%14" — they start with %
    if (/^%\d+$/.test(target)) {
      // Valid pane ID — skip session name validation
    } else {
      // Validate: allow "sessionName" or "sessionName.N"
      const dotIdx = target.indexOf('.')
      const sessionPart = dotIdx === -1 ? target : target.slice(0, dotIdx)
      const panePart = dotIdx === -1 ? null : target.slice(dotIdx + 1)
      validateSessionName(sessionPart)
      if (panePart !== null && !/^\d+$/.test(panePart)) {
        throw new Error(`Invalid pane index: ${panePart}`)
      }
    }

    const args = [
      '-L', this.server,
      'capture-pane',
      '-t', target,
      '-p',     // print to stdout
      '-e',     // preserve ANSI escape sequences
    ]
    if (lines > 0) {
      args.push('-S', `-${lines}`) // start from -N (last N lines of scrollback)
    }

    return new Promise(resolve => {
      // execFile (callback) does NOT use a shell — safe from injection
      execFileCb('tmux', args, { encoding: 'utf8', timeout: 5000 }, (error, stdout) => {
        if (error) {
          resolve([])
          return
        }
        const result = stdout.split('\n')
        // Trim trailing empty lines
        while (result.length > 0 && result[result.length - 1] === '') {
          result.pop()
        }
        resolve(result)
      })
    })
  }

  /** Resize a pane to the given columns (and optionally rows). Uses execFileSync — safe from injection. */
  resizePane(paneId: string, cols: number, rows?: number): TmuxResult {
    const result = this.exec(['-L', this.server, 'resize-pane', '-t', paneId, '-x', String(cols)])
    if (!result.ok) return result
    if (rows) {
      return this.exec(['-L', this.server, 'resize-pane', '-t', paneId, '-y', String(rows)])
    }
    return result
  }

  // ── Interactive ──

  /** Attach to a session (blocks until detach). Returns exit code. */
  attachSession(name: string): number {
    validateSessionName(name)
    try {
      execFileSync('tmux', ['-L', this.server, 'attach', '-t', name], {
        stdio: 'inherit',
        timeout: 0, // no timeout for interactive
      })
      return 0
    } catch {
      return 1
    }
  }

  // ── Internal ──

  /** Execute a tmux command synchronously via execFileSync (no shell — injection-safe). */
  private exec(args: string[]): TmuxResult {
    try {
      // execFileSync does NOT use a shell — args are passed directly
      const output = execFileSync('tmux', args, {
        encoding: 'utf8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'pipe'],
      })
      return { ok: true, output: output ?? '' }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { ok: false, error: message }
    }
  }
}
