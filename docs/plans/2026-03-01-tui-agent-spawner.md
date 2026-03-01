# TUI Agent Spawner Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `meet-ai dashboard` command that spawns multiple Claude Code instances in vertical ink panes, each acting as a team lead for a meet-ai room.

**Architecture:** ink (React for CLI) renders panes in a flexbox row. A ProcessManager spawns `claude -p --output-format stream-json` child processes and pipes stdout into panes. A control room (`__control`) WebSocket listens for spawn/kill requests from the web UI.

**Tech Stack:** ink 5, React 19, Bun, TypeScript, citty (CLI framework), zod (validation)

**Design doc:** `docs/plans/2026-03-01-tui-agent-spawner-design.md`

---

### Task 1: Install ink and configure TSX support

**Files:**
- Modify: `packages/cli/package.json`
- Modify: `packages/cli/tsconfig.json`

**Step 1: Install ink and react**

Run from repo root:
```bash
cd packages/cli && bun add -E ink@5.2.1 react@19.1.0
```

Note: React 19.1.0 is the latest compatible with ink 5. The catalog has 19.2.4 but ink may not support it yet — check compatibility. If 19.2.4 works, use `catalog:` instead.

**Step 2: Enable JSX in tsconfig.json**

Add `"jsx": "react-jsx"` to `compilerOptions` in `packages/cli/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src", "test"]
}
```

**Step 3: Verify build still works**

Run:
```bash
cd packages/cli && bun run build
```
Expected: Builds successfully with no errors.

**Step 4: Commit**

```bash
git add packages/cli/package.json packages/cli/tsconfig.json packages/cli/bun.lock
git commit -m "feat(cli): add ink and react dependencies, enable JSX"
```

---

### Task 2: Stream parser (NDJSON → display lines)

**Files:**
- Create: `packages/cli/src/lib/stream-parser.ts`
- Create: `packages/cli/test/stream-parser.test.ts`

**Step 1: Write the failing tests**

```typescript
// packages/cli/test/stream-parser.test.ts
import { describe, test, expect } from "bun:test";
import { parseLine } from "../src/lib/stream-parser";

describe("parseLine", () => {
  test("extracts text from text_delta event", () => {
    const line = JSON.stringify({
      type: "stream_event",
      event: { delta: { type: "text_delta", text: "Hello world" } },
    });
    expect(parseLine(line)).toEqual({ type: "text", content: "Hello world" });
  });

  test("extracts tool name from content_block_start tool_use", () => {
    const line = JSON.stringify({
      type: "stream_event",
      event: {
        type: "content_block_start",
        content_block: { type: "tool_use", name: "Read" },
      },
    });
    expect(parseLine(line)).toEqual({ type: "tool", content: "[tool: Read]" });
  });

  test("returns null for message_start", () => {
    const line = JSON.stringify({
      type: "stream_event",
      event: { type: "message_start" },
    });
    expect(parseLine(line)).toBeNull();
  });

  test("returns null for message_stop", () => {
    const line = JSON.stringify({
      type: "stream_event",
      event: { type: "message_stop" },
    });
    expect(parseLine(line)).toBeNull();
  });

  test("returns null for empty line", () => {
    expect(parseLine("")).toBeNull();
  });

  test("returns null for malformed JSON", () => {
    expect(parseLine("not json")).toBeNull();
  });

  test("extracts thinking_delta", () => {
    const line = JSON.stringify({
      type: "stream_event",
      event: { delta: { type: "thinking_delta", thinking: "Let me consider..." } },
    });
    expect(parseLine(line)).toEqual({ type: "thinking", content: "Let me consider..." });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd packages/cli && bun test test/stream-parser.test.ts`
Expected: FAIL — module not found.

**Step 3: Implement the stream parser**

```typescript
// packages/cli/src/lib/stream-parser.ts
export type ParsedLine =
  | { type: "text"; content: string }
  | { type: "tool"; content: string }
  | { type: "thinking"; content: string };

export function parseLine(line: string): ParsedLine | null {
  if (!line.trim()) return null;

  try {
    const data = JSON.parse(line);
    const event = data?.event;
    if (!event) return null;

    // Text delta
    if (event.delta?.type === "text_delta") {
      return { type: "text", content: event.delta.text };
    }

    // Thinking delta
    if (event.delta?.type === "thinking_delta") {
      return { type: "thinking", content: event.delta.thinking };
    }

    // Tool use start
    if (
      event.type === "content_block_start" &&
      event.content_block?.type === "tool_use"
    ) {
      return { type: "tool", content: `[tool: ${event.content_block.name}]` };
    }

    return null;
  } catch {
    return null;
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `cd packages/cli && bun test test/stream-parser.test.ts`
Expected: All 7 tests PASS.

**Step 5: Commit**

```bash
git add packages/cli/src/lib/stream-parser.ts packages/cli/test/stream-parser.test.ts
git commit -m "feat(cli): add NDJSON stream parser for Claude output"
```

---

### Task 3: ProcessManager (spawn/track/kill Claude instances)

**Files:**
- Create: `packages/cli/src/lib/process-manager.ts`
- Create: `packages/cli/test/process-manager.test.ts`

**Step 1: Write the failing tests**

Test ProcessManager with a mock process (spawn `echo` instead of `claude`) to verify lifecycle management:

```typescript
// packages/cli/test/process-manager.test.ts
import { describe, test, expect, afterEach } from "bun:test";
import { ProcessManager, type TeamProcess } from "../src/lib/process-manager";

describe("ProcessManager", () => {
  let pm: ProcessManager;

  afterEach(() => {
    pm?.killAll();
  });

  test("spawn adds a process to the map", () => {
    pm = new ProcessManager({ claudePath: "echo", dryRun: true });
    pm.spawn("room-1", "test-room", "do stuff");
    const team = pm.get("room-1");
    expect(team).toBeDefined();
    expect(team!.status).toBe("starting");
    expect(team!.roomName).toBe("test-room");
  });

  test("list returns all tracked processes", () => {
    pm = new ProcessManager({ claudePath: "echo", dryRun: true });
    pm.spawn("room-1", "test-room-1", "task 1");
    pm.spawn("room-2", "test-room-2", "task 2");
    expect(pm.list().length).toBe(2);
  });

  test("kill removes process from map", () => {
    pm = new ProcessManager({ claudePath: "echo", dryRun: true });
    pm.spawn("room-1", "test-room", "do stuff");
    pm.kill("room-1");
    expect(pm.get("room-1")).toBeUndefined();
  });

  test("killAll clears the map", () => {
    pm = new ProcessManager({ claudePath: "echo", dryRun: true });
    pm.spawn("room-1", "r1", "t1");
    pm.spawn("room-2", "r2", "t2");
    pm.killAll();
    expect(pm.list().length).toBe(0);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd packages/cli && bun test test/process-manager.test.ts`
Expected: FAIL — module not found.

**Step 3: Implement ProcessManager**

```typescript
// packages/cli/src/lib/process-manager.ts
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
  onStatusChange?: (roomId: string, status: ProcessStatus, exitCode?: number | null) => void;
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
      "--output-format", "stream-json",
      "--dangerously-skip-permissions",
      "--model", this.opts.model ?? "opus",
      "--append-system-prompt", systemPrompt,
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
      setTimeout(() => {
        if (team.process) {
          team.process.kill("SIGKILL");
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
```

**Step 4: Run tests to verify they pass**

Run: `cd packages/cli && bun test test/process-manager.test.ts`
Expected: All 4 tests PASS.

**Step 5: Commit**

```bash
git add packages/cli/src/lib/process-manager.ts packages/cli/test/process-manager.test.ts
git commit -m "feat(cli): add ProcessManager for spawning Claude instances"
```

---

### Task 4: Control room client (join __control, parse spawn/kill)

**Files:**
- Create: `packages/cli/src/lib/control-room.ts`
- Create: `packages/cli/test/control-room.test.ts`

**Step 1: Write the failing tests**

```typescript
// packages/cli/test/control-room.test.ts
import { describe, test, expect } from "bun:test";
import { parseControlMessage, type ControlMessage } from "../src/lib/control-room";

describe("parseControlMessage", () => {
  test("parses spawn_request", () => {
    const msg = JSON.stringify({
      type: "spawn_request",
      room_name: "fix-login",
      prompt: "Fix the login bug",
      model: "opus",
    });
    const result = parseControlMessage(msg);
    expect(result).toEqual({
      type: "spawn_request",
      room_name: "fix-login",
      prompt: "Fix the login bug",
      model: "opus",
    });
  });

  test("parses kill_request", () => {
    const msg = JSON.stringify({
      type: "kill_request",
      room_id: "abc123",
    });
    const result = parseControlMessage(msg);
    expect(result).toEqual({ type: "kill_request", room_id: "abc123" });
  });

  test("returns null for unknown type", () => {
    const msg = JSON.stringify({ type: "unknown", data: "foo" });
    expect(parseControlMessage(msg)).toBeNull();
  });

  test("returns null for regular chat message", () => {
    const msg = JSON.stringify({
      id: "123",
      sender: "human",
      content: "hello",
    });
    expect(parseControlMessage(msg)).toBeNull();
  });

  test("returns null for invalid JSON", () => {
    expect(parseControlMessage("not json")).toBeNull();
  });

  test("returns null for spawn_request missing room_name", () => {
    const msg = JSON.stringify({
      type: "spawn_request",
      prompt: "do stuff",
    });
    expect(parseControlMessage(msg)).toBeNull();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd packages/cli && bun test test/control-room.test.ts`
Expected: FAIL — module not found.

**Step 3: Implement control room**

```typescript
// packages/cli/src/lib/control-room.ts
import { z } from "zod";
import type { MeetAiClient } from "../types";

const SpawnRequestSchema = z.object({
  type: z.literal("spawn_request"),
  room_name: z.string().min(1),
  prompt: z.string().min(1),
  model: z.string().optional(),
});

const KillRequestSchema = z.object({
  type: z.literal("kill_request"),
  room_id: z.string().min(1),
});

export type ControlMessage =
  | z.infer<typeof SpawnRequestSchema>
  | z.infer<typeof KillRequestSchema>;

export function parseControlMessage(raw: string): ControlMessage | null {
  try {
    const data = JSON.parse(raw);
    if (!data?.type) return null;

    if (data.type === "spawn_request") {
      const result = SpawnRequestSchema.safeParse(data);
      return result.success ? result.data : null;
    }
    if (data.type === "kill_request") {
      const result = KillRequestSchema.safeParse(data);
      return result.success ? result.data : null;
    }

    return null;
  } catch {
    return null;
  }
}

const CONTROL_ROOM_NAME = "__control";

export async function ensureControlRoom(
  client: MeetAiClient,
): Promise<string> {
  // Try to find existing __control room
  // The client doesn't have a listRooms method exposed,
  // so we create and catch duplicate error, or always create.
  // For now, create — if it already exists the API returns the existing one
  // (the worker's POST /api/rooms returns existing room if name matches).
  const room = await client.createRoom(CONTROL_ROOM_NAME);
  return room.id;
}

export function sendStatus(
  client: MeetAiClient,
  controlRoomId: string,
  status: Record<string, unknown>,
): void {
  client
    .sendMessage(controlRoomId, "dashboard", JSON.stringify(status))
    .catch(() => {
      // Best-effort — don't crash the TUI if status send fails
    });
}
```

**Step 4: Run tests to verify they pass**

Run: `cd packages/cli && bun test test/control-room.test.ts`
Expected: All 6 tests PASS.

**Step 5: Commit**

```bash
git add packages/cli/src/lib/control-room.ts packages/cli/test/control-room.test.ts
git commit -m "feat(cli): add control room message parsing"
```

---

### Task 5: ink TUI components

**Files:**
- Create: `packages/cli/src/tui/app.tsx`
- Create: `packages/cli/src/tui/dashboard.tsx`
- Create: `packages/cli/src/tui/pane.tsx`
- Create: `packages/cli/src/tui/status-bar.tsx`
- Create: `packages/cli/src/tui/spawn-dialog.tsx`

**Step 1: Create `Pane` component**

The foundational display component. A bordered box with a header (room name + status) and scrollable output lines.

```tsx
// packages/cli/src/tui/pane.tsx
import React from "react";
import { Box, Text } from "ink";
import type { ProcessStatus } from "../lib/process-manager";

const STATUS_ICONS: Record<ProcessStatus, string> = {
  starting: "...",
  running: ">>>",
  exited: "[done]",
  error: "[err]",
};

interface PaneProps {
  roomName: string;
  status: ProcessStatus;
  lines: string[];
  focused: boolean;
  height: number;
}

export function Pane({ roomName, status, lines, focused, height }: PaneProps) {
  // Show last N lines that fit in the pane
  const visibleLines = lines.slice(-(height - 2)); // subtract header + border

  return (
    <Box
      flexDirection="column"
      flexGrow={1}
      borderStyle={focused ? "double" : "single"}
      borderColor={focused ? "cyan" : "gray"}
      height={height}
    >
      <Box>
        <Text bold color={focused ? "cyan" : "white"}>
          {" "}{roomName}{" "}
        </Text>
        <Text dimColor>{STATUS_ICONS[status]}</Text>
      </Box>
      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        {visibleLines.map((line, i) => (
          <Text key={i} wrap="truncate">
            {line}
          </Text>
        ))}
      </Box>
    </Box>
  );
}
```

**Step 2: Create `StatusBar` component**

```tsx
// packages/cli/src/tui/status-bar.tsx
import React from "react";
import { Box, Text } from "ink";

interface StatusBarProps {
  teamCount: number;
  focusedRoom: string | null;
  showingSpawnDialog: boolean;
}

export function StatusBar({ teamCount, focusedRoom, showingSpawnDialog }: StatusBarProps) {
  if (showingSpawnDialog) {
    return (
      <Box>
        <Text dimColor>Enter room name and prompt. Press </Text>
        <Text bold>Escape</Text>
        <Text dimColor> to cancel.</Text>
      </Box>
    );
  }

  return (
    <Box justifyContent="space-between">
      <Box gap={2}>
        <Text dimColor>[</Text><Text bold color="green">n</Text><Text dimColor>]ew</Text>
        <Text dimColor>[</Text><Text bold color="red">k</Text><Text dimColor>]ill</Text>
        <Text dimColor>[</Text><Text bold>←→</Text><Text dimColor>]focus</Text>
        <Text dimColor>[</Text><Text bold color="yellow">q</Text><Text dimColor>]uit</Text>
      </Box>
      <Box gap={2}>
        {focusedRoom && <Text color="cyan">{focusedRoom}</Text>}
        <Text dimColor>{teamCount} team{teamCount !== 1 ? "s" : ""}</Text>
      </Box>
    </Box>
  );
}
```

**Step 3: Create `SpawnDialog` component**

```tsx
// packages/cli/src/tui/spawn-dialog.tsx
import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

interface SpawnDialogProps {
  onSubmit: (roomName: string, prompt: string) => void;
  onCancel: () => void;
}

export function SpawnDialog({ onSubmit, onCancel }: SpawnDialogProps) {
  const [step, setStep] = useState<"name" | "prompt">("name");
  const [roomName, setRoomName] = useState("");
  const [prompt, setPrompt] = useState("");

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    if (key.return) {
      if (step === "name" && roomName.trim()) {
        setStep("prompt");
      } else if (step === "prompt" && prompt.trim()) {
        onSubmit(roomName.trim(), prompt.trim());
      }
      return;
    }

    if (key.backspace || key.delete) {
      if (step === "name") setRoomName((v) => v.slice(0, -1));
      else setPrompt((v) => v.slice(0, -1));
      return;
    }

    if (input && !key.ctrl && !key.meta) {
      if (step === "name") setRoomName((v) => v + input);
      else setPrompt((v) => v + input);
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="green" paddingX={1}>
      <Text bold color="green">New Team</Text>
      <Box>
        <Text>Room name: </Text>
        <Text color={step === "name" ? "cyan" : "white"}>{roomName}</Text>
        {step === "name" && <Text color="cyan">█</Text>}
      </Box>
      {step === "prompt" && (
        <Box>
          <Text>Prompt: </Text>
          <Text color="cyan">{prompt}</Text>
          <Text color="cyan">█</Text>
        </Box>
      )}
    </Box>
  );
}
```

**Step 4: Create `Dashboard` component**

```tsx
// packages/cli/src/tui/dashboard.tsx
import React from "react";
import { Box, Text } from "ink";
import { Pane } from "./pane";
import type { TeamProcess } from "../lib/process-manager";

interface DashboardProps {
  teams: TeamProcess[];
  focusedIndex: number;
  height: number;
}

export function Dashboard({ teams, focusedIndex, height }: DashboardProps) {
  if (teams.length === 0) {
    return (
      <Box flexGrow={1} alignItems="center" justifyContent="center">
        <Text dimColor>No teams running. Press </Text>
        <Text bold color="green">n</Text>
        <Text dimColor> to spawn a new team.</Text>
      </Box>
    );
  }

  return (
    <Box flexGrow={1} flexDirection="row">
      {teams.map((team, index) => (
        <Pane
          key={team.roomId}
          roomName={team.roomName}
          status={team.status}
          lines={team.lines}
          focused={index === focusedIndex}
          height={height}
        />
      ))}
    </Box>
  );
}
```

**Step 5: Create `App` root component**

```tsx
// packages/cli/src/tui/app.tsx
import React, { useState, useCallback, useEffect } from "react";
import { Box, useInput, useApp, useStdout } from "ink";
import { Dashboard } from "./dashboard";
import { StatusBar } from "./status-bar";
import { SpawnDialog } from "./spawn-dialog";
import { ProcessManager, type ProcessStatus } from "../lib/process-manager";
import type { MeetAiClient } from "../types";
import {
  ensureControlRoom,
  parseControlMessage,
  sendStatus,
} from "../lib/control-room";

interface AppProps {
  processManager: ProcessManager;
  client: MeetAiClient;
}

export function App({ processManager, client }: AppProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [teams, setTeams] = useState(processManager.list());
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [showSpawn, setShowSpawn] = useState(false);
  const [controlRoomId, setControlRoomId] = useState<string | null>(null);

  const terminalHeight = stdout?.rows ?? 24;
  const dashboardHeight = terminalHeight - 2; // status bar + padding

  const refreshTeams = useCallback(() => {
    setTeams([...processManager.list()]);
  }, [processManager]);

  // Set up control room WebSocket on mount
  useEffect(() => {
    let ws: WebSocket | null = null;

    ensureControlRoom(client).then((roomId) => {
      setControlRoomId(roomId);

      ws = client.listen(roomId, {
        onMessage: (msg) => {
          const cmd = parseControlMessage(msg.content);
          if (!cmd) return;

          if (cmd.type === "spawn_request") {
            handleSpawn(cmd.room_name, cmd.prompt, cmd.model);
          } else if (cmd.type === "kill_request") {
            handleKillById(cmd.room_id);
          }
        },
      });
    });

    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close(1000, "dashboard shutdown");
      }
    };
  }, []);

  // Refresh TUI every 200ms to pick up new lines
  useEffect(() => {
    const interval = setInterval(refreshTeams, 200);
    return () => clearInterval(interval);
  }, [refreshTeams]);

  const handleSpawn = useCallback(
    async (roomName: string, prompt: string, model?: string) => {
      try {
        const room = await client.createRoom(roomName);
        processManager.spawn(room.id, roomName, prompt);
        refreshTeams();

        if (controlRoomId) {
          sendStatus(client, controlRoomId, {
            type: "team_started",
            room_id: room.id,
            room_name: roomName,
          });
        }
      } catch {
        // Room creation failed — silently ignore in TUI
      }
    },
    [client, processManager, controlRoomId, refreshTeams],
  );

  const handleKillById = useCallback(
    (roomId: string) => {
      processManager.kill(roomId);
      refreshTeams();
      if (controlRoomId) {
        sendStatus(client, controlRoomId, {
          type: "team_killed",
          room_id: roomId,
        });
      }
    },
    [processManager, controlRoomId, refreshTeams],
  );

  useInput((input, key) => {
    if (showSpawn) return; // SpawnDialog handles its own input

    if (input === "q") {
      processManager.killAll();
      exit();
      return;
    }

    if (input === "n") {
      setShowSpawn(true);
      return;
    }

    if (input === "k" && teams.length > 0) {
      const team = teams[focusedIndex];
      if (team) handleKillById(team.roomId);
      if (focusedIndex >= teams.length - 1) {
        setFocusedIndex(Math.max(0, focusedIndex - 1));
      }
      return;
    }

    if (key.leftArrow) {
      setFocusedIndex((i) => Math.max(0, i - 1));
    }
    if (key.rightArrow) {
      setFocusedIndex((i) => Math.min(teams.length - 1, i + 1));
    }
  });

  return (
    <Box flexDirection="column" height={terminalHeight}>
      <Dashboard
        teams={teams}
        focusedIndex={focusedIndex}
        height={dashboardHeight}
      />
      {showSpawn ? (
        <SpawnDialog
          onSubmit={(name, prompt) => {
            setShowSpawn(false);
            handleSpawn(name, prompt);
          }}
          onCancel={() => setShowSpawn(false)}
        />
      ) : (
        <StatusBar
          teamCount={teams.length}
          focusedRoom={teams[focusedIndex]?.roomName ?? null}
          showingSpawnDialog={false}
        />
      )}
    </Box>
  );
}
```

**Step 6: Verify typecheck**

Run: `cd packages/cli && bunx tsc --noEmit`
Expected: No type errors.

**Step 7: Commit**

```bash
git add packages/cli/src/tui/
git commit -m "feat(cli): add ink TUI components for dashboard"
```

---

### Task 6: Dashboard command (citty wiring)

**Files:**
- Create: `packages/cli/src/commands/dashboard/command.ts`
- Create: `packages/cli/src/commands/dashboard/usecase.ts`
- Modify: `packages/cli/src/index.ts`
- Modify: `packages/cli/src/spawner.ts`

**Step 1: Create the usecase**

```typescript
// packages/cli/src/commands/dashboard/usecase.ts
import React from "react";
import { render } from "ink";
import { App } from "../../tui/app";
import { ProcessManager } from "../../lib/process-manager";
import type { MeetAiClient } from "../../types";
import type { MeetAiConfig } from "../../config";

export function startDashboard(client: MeetAiClient, config: MeetAiConfig): void {
  // Find Claude CLI — reuse existing logic
  const { findClaudeCli } = require("../../spawner") as { findClaudeCli: () => string };
  const claudePath = findClaudeCli();

  const processManager = new ProcessManager({
    claudePath,
    env: {
      ...(config.url ? { MEET_AI_URL: config.url } : {}),
      ...(config.key ? { MEET_AI_KEY: config.key } : {}),
    },
  });

  // Cleanup on exit
  function cleanup() {
    processManager.killAll();
    process.exit(0);
  }
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  const element = React.createElement(App, { processManager, client });
  render(element);
}
```

**Step 2: Create the command definition**

```typescript
// packages/cli/src/commands/dashboard/command.ts
import { defineCommand } from "citty";
import { getClient } from "../../lib/client-factory";
import { getMeetAiConfig } from "../../config";
import { startDashboard } from "./usecase";
import { err } from "../../lib/output";

export default defineCommand({
  meta: {
    name: "dashboard",
    description: "TUI dashboard for spawning and viewing agent teams",
  },
  run() {
    try {
      const client = getClient();
      const config = getMeetAiConfig();
      startDashboard(client, config);
    } catch (error) {
      err(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  },
});
```

**Step 3: Export `findClaudeCli` from spawner**

In `packages/cli/src/spawner.ts`, change `function findClaudeCli()` to `export function findClaudeCli()` so the dashboard usecase can reuse it.

**Step 4: Register the command in index.ts**

Add to the `subCommands` object in `packages/cli/src/index.ts`:

```typescript
dashboard: () =>
  import("./commands/dashboard/command").then((m) => m.default),
```

**Step 5: Verify typecheck**

Run: `cd packages/cli && bunx tsc --noEmit`
Expected: No type errors.

**Step 6: Manual smoke test**

Run: `cd packages/cli && bun run src/index.ts dashboard`
Expected: Empty dashboard renders with status bar showing keybind hints.

**Step 7: Commit**

```bash
git add packages/cli/src/commands/dashboard/ packages/cli/src/index.ts packages/cli/src/spawner.ts
git commit -m "feat(cli): add meet-ai dashboard command"
```

---

### Task 7: End-to-end smoke test

**Files:**
- None created — manual verification

**Step 1: Start the dashboard**

Run: `cd packages/cli && bun run src/index.ts dashboard`

**Step 2: Press `n` to spawn a team**

Enter room name: `test-team`
Enter prompt: `List the files in this directory and describe each one`

Expected: A new pane appears with streaming Claude output.

**Step 3: Press `k` to kill the team**

Expected: Pane disappears, process is terminated.

**Step 4: Press `q` to quit**

Expected: Clean exit, no orphaned processes. Verify: `ps aux | grep claude` shows no leftover processes.

**Step 5: Test web UI spawn (if web UI is running)**

From another terminal, send a spawn request to __control:
```bash
meet-ai send-message <control-room-id> "human" '{"type":"spawn_request","room_name":"remote-test","prompt":"Say hello"}'
```

Expected: New pane appears in the dashboard.

**Step 6: Commit all remaining changes if any**

```bash
git add -A && git commit -m "feat(cli): finalize dashboard command"
```

---

## Summary

| Task | What it builds | Estimated steps |
|------|---------------|-----------------|
| 1 | Install ink, enable JSX | 4 |
| 2 | Stream parser (NDJSON → display) | 5 |
| 3 | ProcessManager (spawn/track/kill) | 5 |
| 4 | Control room (WebSocket commands) | 5 |
| 5 | ink TUI components | 7 |
| 6 | Dashboard command (wiring) | 7 |
| 7 | E2E smoke test | 6 |

Total: 7 tasks, 39 steps
