import { spawn, type ChildProcess } from "node:child_process";
import { Terminal, type IBufferCell, type IBufferLine } from "@xterm/headless";

export type ProcessStatus = "starting" | "running" | "exited" | "error";

export interface TeamProcess {
  roomId: string;
  roomName: string;
  pid: number | null;
  process: ChildProcess | null;
  status: ProcessStatus;
  exitCode: number | null;
  lines: string[];
}

interface ProcessManagerOptions {
  claudePath: string;
  model?: string;
  dryRun?: boolean;
  debug?: boolean;
  env?: Record<string, string>;
  onStatusChange?: (
    roomId: string,
    status: ProcessStatus,
    exitCode?: number | null,
  ) => void;
}

/** Default virtual terminal size — matches typical Claude Code output. */
const TERM_COLS = 120;
const TERM_ROWS = 50;

const ESC = "\x1b[";
const RESET = `${ESC}0m`;

/** Extract R, G, B components from a 0xRRGGBB integer without bitwise ops. */
function rgbComponents(v: number): [number, number, number] {
  const r = Math.floor(v / 65536) % 256;
  const g = Math.floor(v / 256) % 256;
  const b = v % 256;
  return [r, g, b];
}

/**
 * Build the SGR (Select Graphic Rendition) parameter string for a cell.
 * Returns "" when the cell uses default styling.
 */
function cellSgr(cell: IBufferCell): string {
  const params: number[] = [];

  if (cell.isBold()) params.push(1);
  if (cell.isDim()) params.push(2);
  if (cell.isItalic()) params.push(3);
  if (cell.isUnderline()) params.push(4);
  if (cell.isInverse()) params.push(7);
  if (cell.isStrikethrough()) params.push(9);

  // Foreground
  if (cell.isFgRGB()) {
    const [r, g, b] = rgbComponents(cell.getFgColor());
    params.push(38, 2, r, g, b);
  } else if (cell.isFgPalette()) {
    const c = cell.getFgColor();
    if (c < 8) params.push(30 + c);
    else if (c < 16) params.push(90 + (c - 8));
    else params.push(38, 5, c);
  }

  // Background
  if (cell.isBgRGB()) {
    const [r, g, b] = rgbComponents(cell.getBgColor());
    params.push(48, 2, r, g, b);
  } else if (cell.isBgPalette()) {
    const c = cell.getBgColor();
    if (c < 8) params.push(40 + c);
    else if (c < 16) params.push(100 + (c - 8));
    else params.push(48, 5, c);
  }

  if (params.length === 0) return "";
  return `${ESC}${params.join(";")}m`;
}

/**
 * Convert one xterm buffer row into a string with embedded ANSI escape codes.
 * Trailing whitespace with default styling is trimmed.
 */
function rowToAnsi(row: IBufferLine, cell: IBufferCell): string {
  // First pass: find rightmost non-empty cell (trim trailing whitespace)
  let rightmost = -1;
  for (let x = row.length - 1; x >= 0; x--) {
    const c = row.getCell(x, cell);
    if (!c) continue;
    const ch = c.getChars();
    if (ch !== "" && ch !== " ") {
      rightmost = x;
      break;
    }
    // Space with non-default styling counts as content
    if (ch === " " && !c.isAttributeDefault()) {
      rightmost = x;
      break;
    }
  }

  if (rightmost < 0) return "";

  let out = "";
  let prevSgr = "";

  for (let x = 0; x <= rightmost; x++) {
    const c = row.getCell(x, cell);
    if (!c) continue;
    if (c.getWidth() === 0) continue; // right half of wide char

    const sgr = cellSgr(c);
    if (sgr !== prevSgr) {
      // Reset then apply new style (simplest approach, avoids state tracking)
      if (prevSgr !== "") out += RESET;
      if (sgr !== "") out += sgr;
      prevSgr = sgr;
    }

    const ch = c.getChars();
    out += ch || " ";
  }

  // Close any open SGR
  if (prevSgr !== "") out += RESET;

  return out;
}

export class ProcessManager {
  private teams = new Map<string, TeamProcess>();
  private terminals = new Map<string, Terminal>();
  private opts: ProcessManagerOptions;

  constructor(opts: ProcessManagerOptions) {
    this.opts = opts;
  }

  /** Read the virtual terminal screen buffer into team.lines with ANSI colors preserved. */
  private syncLines(team: TeamProcess): void {
    const term = this.terminals.get(team.roomId);
    if (!term) return;

    const buf = term.buffer.active;
    const lines: string[] = [];
    const cell = buf.getNullCell();

    // Read all rows from scrollback + visible area
    for (let i = 0; i < buf.length; i++) {
      const row = buf.getLine(i);
      if (row) {
        lines.push(rowToAnsi(row, cell));
      }
    }

    // Trim trailing empty lines
    while (lines.length > 0 && lines[lines.length - 1] === "") {
      lines.pop();
    }

    team.lines = lines;
  }

  spawn(roomId: string, roomName: string): TeamProcess {
    const team: TeamProcess = {
      roomId,
      roomName,
      pid: null,
      process: null,
      status: "starting",
      exitCode: null,
      lines: [],
    };

    this.teams.set(roomId, team);

    if (this.opts.dryRun) return team;

    // Create virtual terminal to interpret PTY escape sequences
    const term = new Terminal({
      cols: TERM_COLS,
      rows: TERM_ROWS,
      scrollback: 500,
      allowProposedApi: true,
    });
    this.terminals.set(roomId, term);

    const fullPrompt = [
      `MEET_AI_ROOM_ID: ${roomId}`,
      `MEET_AI_AGENT_NAME: team-lead`,
      ``,
      `You are a team lead. IMMEDIATELY:`,
      `1. Create a team of agents to work on the task`,
      `2. Connect to the meet-ai room using the /meet-ai skill`,
      `3. Delegate work to your teammates`,
      ``,
      `Do NOT wait — start the team right away, then use the room for communication.`,
      ``,
      `Start listening for human messages in the background:`,
      `  meet-ai listen "${roomId}" --sender-type human --team "${roomName}" --inbox team-lead`,
    ].join("\n");

    const claudeArgs = [
      "--dangerously-skip-permissions",
      "--model",
      this.opts.model ?? "opus",
      fullPrompt,
    ];

    // Must DELETE CLAUDECODE entirely — setting to "" still triggers
    // Claude's nested-session detection (presence check).
    const { CLAUDECODE: _, ...envWithoutClaude } = process.env;
    const childEnv = {
      ...envWithoutClaude,
      ...this.opts.env,
      DISABLE_AUTOUPDATER: "1",
    };

    // Use macOS `script` to allocate a real PTY for each Claude instance.
    // `script -q /dev/null cmd args...` runs cmd in a PTY, outputs to stdout.
    // This gives Claude a full interactive TTY without native deps like node-pty.
    const spawnCmd = "/usr/bin/script";
    const spawnArgs = [
      "-q",
      "/dev/null",
      this.opts.claudePath,
      ...claudeArgs,
    ];

    if (this.opts.debug) {
      team.lines.push(
        `[debug] CMD: ${this.opts.claudePath} ${claudeArgs.join(" ").slice(0, 200)}`,
      );
      team.lines.push(
        `[debug] ENV: ${Object.keys(this.opts.env ?? {}).join(", ") || "(none)"}`,
      );
    }

    const child = spawn(spawnCmd, spawnArgs, {
      stdio: ["ignore", "pipe", "pipe"],
      env: childEnv,
      detached: false,
    });

    team.process = child;
    team.pid = child.pid ?? null;
    team.status = "running";
    this.opts.onStatusChange?.(roomId, "running");

    // Feed raw PTY output into virtual terminal
    child.stdout?.on("data", (chunk: Buffer) => {
      term.write(chunk.toString());
      this.syncLines(team);

      if (team.status === "starting") {
        team.status = "running";
        this.opts.onStatusChange?.(roomId, "running");
      }
    });

    // Capture stderr separately (not part of the virtual terminal)
    child.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString().trim();
      if (text) {
        // Append stderr after the screen content
        team.lines.push(`[stderr] ${text}`);
      }
    });

    child.on("exit", (code, signal) => {
      // Final sync
      this.syncLines(team);

      if (this.opts.debug) {
        team.lines.push(`[debug] exit code=${code} signal=${signal}`);
      }

      team.exitCode = code;
      team.status = code === 0 || code === null ? "exited" : "error";
      team.process = null;

      // Dispose terminal
      term.dispose();
      this.terminals.delete(roomId);

      this.opts.onStatusChange?.(roomId, team.status, code);
    });

    child.on("error", (err) => {
      team.status = "error";
      team.lines.push(`[error] ${err.message}`);
      team.process = null;

      term.dispose();
      this.terminals.delete(roomId);

      this.opts.onStatusChange?.(roomId, "error");
    });

    return team;
  }

  /** Add an error entry so the TUI can display spawn failures. */
  addError(roomId: string, roomName: string, message: string): void {
    this.teams.set(roomId, {
      roomId,
      roomName,
      pid: null,
      process: null,
      status: "error",
      exitCode: null,
      lines: [`[error] ${message}`],
    });
  }

  get(roomId: string): TeamProcess | undefined {
    return this.teams.get(roomId);
  }

  list(): TeamProcess[] {
    return [...this.teams.values()];
  }

  kill(roomId: string): void {
    const team = this.teams.get(roomId);
    if (team?.process) {
      team.process.kill("SIGTERM");
      const proc = team.process;
      setTimeout(() => {
        try {
          proc.kill("SIGKILL");
        } catch {
          // Process already exited
        }
      }, 3000);
    }

    // Cleanup terminal
    const term = this.terminals.get(roomId);
    if (term) {
      term.dispose();
      this.terminals.delete(roomId);
    }

    this.teams.delete(roomId);
  }

  killAll(): void {
    for (const roomId of this.teams.keys()) {
      this.kill(roomId);
    }
  }
}
