import { spawn, type ChildProcess } from "node:child_process";
import { parseLine, type ParsedLine } from "./stream-parser";

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
  maxLines?: number;
  dryRun?: boolean;
  env?: Record<string, string>;
  onLine?: (roomId: string, parsed: ParsedLine) => void;
  onStatusChange?: (
    roomId: string,
    status: ProcessStatus,
    exitCode?: number | null,
  ) => void;
}

const MAX_LINES = 500;

export class ProcessManager {
  private teams = new Map<string, TeamProcess>();
  private opts: ProcessManagerOptions;

  constructor(opts: ProcessManagerOptions) {
    this.opts = opts;
  }

  spawn(roomId: string, roomName: string, prompt: string): TeamProcess {
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

    const systemPrompt = [
      `You are a team lead for room "${roomName}".`,
      `Use meet-ai CLI for all communication:`,
      `  meet-ai send-message ${roomId} "team-lead" "message"`,
      `  meet-ai listen ${roomId}`,
      `  meet-ai poll ${roomId}`,
    ].join("\n");

    const args = [
      "-p",
      "--output-format",
      "stream-json",
      "--dangerously-skip-permissions",
      "--model",
      this.opts.model ?? "opus",
      "--append-system-prompt",
      systemPrompt,
      prompt,
    ];

    const child = spawn(this.opts.claudePath, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        ...this.opts.env,
        CLAUDECODE: "",
        DISABLE_AUTOUPDATER: "1",
      },
      detached: false,
    });

    team.process = child;
    team.pid = child.pid ?? null;

    // Parse stdout line by line
    let buffer = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;
        const parsed = parseLine(line);
        if (parsed) {
          const maxLines = this.opts.maxLines ?? MAX_LINES;
          team.lines.push(parsed.content);
          if (team.lines.length > maxLines) {
            team.lines.shift();
          }
          this.opts.onLine?.(roomId, parsed);
        }
      }

      // Mark running on first output
      if (team.status === "starting") {
        team.status = "running";
        this.opts.onStatusChange?.(roomId, "running");
      }
    });

    // Log stderr (Claude's own diagnostic output)
    child.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString().trim();
      if (text) {
        const maxLines = this.opts.maxLines ?? MAX_LINES;
        team.lines.push(`[stderr] ${text}`);
        if (team.lines.length > maxLines) {
          team.lines.shift();
        }
      }
    });

    child.on("exit", (code) => {
      team.exitCode = code;
      team.status = code === 0 || code === null ? "exited" : "error";
      team.process = null;
      this.opts.onStatusChange?.(roomId, team.status, code);
    });

    child.on("error", (err) => {
      team.status = "error";
      team.lines.push(`[error] ${err.message}`);
      team.process = null;
      this.opts.onStatusChange?.(roomId, "error");
    });

    return team;
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
      // Force kill after 3s
      const proc = team.process;
      setTimeout(() => {
        try {
          proc.kill("SIGKILL");
        } catch {
          // Process already exited
        }
      }, 3000);
    }
    this.teams.delete(roomId);
  }

  killAll(): void {
    for (const roomId of this.teams.keys()) {
      this.kill(roomId);
    }
  }
}
