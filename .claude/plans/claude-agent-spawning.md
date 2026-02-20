# Claude Agent Spawning Implementation Plan

## Overview

Simplified implementation for spawning Claude Code instances via the `meet-ai` CLI. The primary use case is:

1. **User creates a chat on UI** → Backend spawns a Claude instance for that room
2. **Spawned Claude acts as orchestrator** → Uses internal Claude Code Teams feature to manage its own agents
3. **CLI provides communication layer** → Chat rooms, messaging, WebSocket listening

**Key decision**: No programmatic agent management in CLI. Spawning is handled by the backend listening to WebSocket messages.

---

## Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              User Action                                     │
│                         (Create chat on UI)                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ WebSocket
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           meet-ai Backend                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                       │
│  │  WebSocket   │  │   Spawner    │  │  ChatRoom    │                       │
│  │   Listener   │──│   Service    │──│     DO       │                       │
│  └──────────────┘  └──────────────┘  └──────────────┘                       │
│         │                 │                                                  │
│         │ {type:"spawn_orchestrator",roomId:"..."}                           │
│         ▼                 ▼                                                  │
│  ┌──────────────────────────────────────┐                                   │
│  │  Spawn: meet-ai (interactive)        │                                   │
│  │  Or: Backend spawns Claude directly  │                                   │
│  └──────────────────────────────────────┘                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ spawns
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Claude Code Instance                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Acts as Orchestrator                                               │    │
│  │                                                                     │    │
│  │  • Receives room assignment via env var or prompt                   │    │
│  │  • Creates teams internally using Claude Code Teams feature         │    │
│  │  • Manages its own agent lifecycle (spawn/kill teammates)           │    │
│  │  • Uses meet-ai CLI for room communication                          │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ uses CLI
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           meet-ai CLI                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ Interactive  │  │  create-room │  │ send-message │  │    listen    │    │
│  │   (default)  │  │              │  │              │  │              │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **User creates chat** → WebSocket message to backend
2. **Backend spawns Claude** → Either via direct spawn or CLI invocation
3. **Claude starts as orchestrator** → Uses meet-ai CLI for room communication
4. **Orchestrator manages team** → Internal Claude Code Teams feature
5. **Agents communicate** → Via meet-ai rooms using CLI commands

---

## Files Created/Modified

### New Files

| File | Purpose |
|------|---------|
| `src/config.ts` | Multi-source configuration loading (env → project settings → user settings) |
| `src/spawner.ts` | Simple Claude Code spawner for interactive mode |

### Modified Files

| File | Changes |
|------|---------|
| `src/index.ts` | Updated default behavior to run Claude interactively; added config loading |

### Removed (Not Implemented)

The following were in original plan but removed:

- ~~`src/discovery.ts`~~ → Merged into `spawner.ts`
- ~~`src/session.ts`~~ → Not needed
- ~~`src/state.ts`~~ → Not needed
- ~~`src/launcher-template.mjs`~~ → Not needed
- ~~`src/types.ts`~~ → Not needed
- ~~`src/commands/spawn.ts`~~ → Removed
- ~~`src/commands/agents.ts`~~ → Removed
- ~~`src/commands/kill.ts`~~ → Removed
- ~~`src/commands/kill-all.ts`~~ → Removed
- ~~`src/commands/status.ts`~~ → Removed
- ~~All test files~~ → Not created

---

## Implementation

### Phase 1: Configuration (Completed)

**File: `src/config.ts`**

Loads configuration from multiple sources in priority order:
1. Environment variables (`MEET_AI_URL`, `MEET_AI_KEY`)
2. Project settings (`./.claude/settings.json`)
3. User settings (`~/.claude/settings.json`)
4. Defaults

```typescript
export function getMeetAiConfig(): {
  url: string;
  key: string | undefined;
}
```

### Phase 2: Spawning (Completed)

**File: `src/spawner.ts`**

Simple spawner that finds Claude Code and runs it interactively:

```typescript
export async function spawnInteractive(): Promise<void>
```

Discovery order:
1. Check `PATH` (`which claude`)
2. Check `MEET_AI_CLAUDE_PATH` env var
3. Check common locations (Homebrew, etc.)

### Phase 3: CLI Integration (Completed)

**File: `src/index.ts`**

Default behavior (no command):
```bash
meet-ai  # Runs Claude Code interactively
```

Standard commands:
```bash
meet-ai create-room <name>
meet-ai send-message <roomId> <sender> <content> [--color <color>]
meet-ai listen <roomId> [options]
meet-ai poll <roomId> [options]
# etc.
```

---

## CLI Commands

### Default Behavior

```bash
# Run Claude Code interactively (default when no command provided)
meet-ai

# Equivalent to running: claude
```

### API Endpoints

#### Spawn Orchestrator

**Endpoint:** `POST /api/rooms/:id/spawn`

Initiates a request to spawn a Claude orchestrator for an existing room.

**Request:**
```bash
POST /api/rooms/abc-123/spawn
Authorization: Bearer <api-key>
```

**Response:**
```json
{
  "roomId": "abc-123",
  "spawnToken": "uuid-v4",
  "ready": true,
  "config": {
    "roomId": "abc-123",
    "roomName": "my-project",
    "apiUrl": "https://meet-ai.cc"
  }
}
```

**Usage:**
The frontend or a local service receives this configuration and spawns Claude Code with the appropriate room context.

### Standard Commands

All existing meet-ai CLI commands remain unchanged:

| Command | Usage | Description |
|---------|-------|-------------|
| `create-room` | `meet-ai create-room <name>` | Create a new chat room |
| `delete-room` | `meet-ai delete-room <roomId>` | Delete a room |
| `send-message` | `meet-ai send-message <roomId> <sender> <content>` | Send message to room |
| `send-log` | `meet-ai send-log <roomId> <sender> <content>` | Send log entry |
| `poll` | `meet-ai poll <roomId> [options]` | Fetch messages |
| `listen` | `meet-ai listen <roomId> [options]` | WebSocket stream |
| `download-attachment` | `meet-ai download-attachment <id>` | Download attachment |
| `send-team-info` | `meet-ai send-team-info <roomId> '<json>'` | Update team sidebar |
| `send-tasks` | `meet-ai send-tasks <roomId> '<json>'` | Update tasks sidebar |
| `generate-key` | `meet-ai generate-key` | Generate API key |

---

## Configuration

### Priority Order

1. **Environment Variables** (highest priority)
   ```bash
   export MEET_AI_URL="https://meet-ai.cc"
   export MEET_AI_KEY="mai_xxx"
   ```

2. **Project Settings** (`./.claude/settings.json`)
   ```json
   {
     "env": {
       "MEET_AI_URL": "http://localhost:8787",
       "MEET_AI_KEY": "mai_xxx"
     }
   }
   ```

3. **User Settings** (`~/.claude/settings.json`)
   ```json
   {
     "env": {
       "MEET_AI_URL": "https://meet-ai.cc",
       "MEET_AI_KEY": "mai_xxx"
     }
   }
   ```

4. **Defaults**
   - `MEET_AI_URL`: `https://meet-ai.cc`
   - `MEET_AI_KEY`: `undefined`

---

## Use Case: Web UI → Orchestrator Spawn

### Backend Implementation

When user creates a chat on the web UI:

```javascript
// Backend WebSocket handler
socket.on('message', async (data) => {
  const message = JSON.parse(data);
  
  if (message.type === 'spawn_orchestrator') {
    const { roomId, workingDir } = message;
    
    // Option 1: Spawn via CLI (if running on same machine)
    const { spawnInteractive } = await import('@meet-ai/cli/spawner');
    // ...or spawn directly
    
    // Option 2: Spawn Claude directly
    const { spawn } = require('child_process');
    const child = spawn('claude', [], {
      detached: true,
      env: {
        ...process.env,
        MEET_AI_ROOM_ID: roomId,
        DISABLE_AUTOUPDATER: '1',
      },
      cwd: workingDir,
    });
    
    // Store PID for management
    await storeOrchestratorPid(roomId, child.pid);
  }
});
```

### Orchestrator Behavior

The spawned Claude instance (orchestrator):

1. **Starts up** with access to room ID (via env or initial prompt)
2. **Creates meet-ai.json** to enable hooks:
   ```json
   {"room_id": "<ROOM_ID>", "session_id": "<SESSION_ID>"}
   ```
3. **Starts listener** for human messages:
   ```bash
   meet-ai listen "<ROOM_ID>" --sender-type human --team "<team>" --inbox team-lead
   ```
4. **Creates teams** using Claude Code's built-in Teams feature:
   - Uses `Task` tool to spawn teammates
   - Manages agent lifecycle internally
   - No CLI involvement needed

---

## Simplifications from Original Plan

### Removed Features

| Original Plan | Simplified To | Reason |
|--------------|---------------|--------|
| Agent registry (`~/.meet-ai/agents.json`) | Not implemented | Backend manages orchestrators |
| Session management | Not implemented | Each spawn is independent |
| Launcher script with fetch() interception | Not implemented | Not needed for basic functionality |
| Thinking state tracking | Not implemented | Can be added later if needed |
| `spawn`/`agents`/`kill` commands | Removed | Backend handles orchestrator lifecycle |
| Tmux integration | Removed | Not needed |
| Complex state transitions | Not implemented | Simplified architecture |

### What We Kept

1. ✅ Claude Code discovery (PATH, env vars, common locations)
2. ✅ Interactive mode (`meet-ai` with no args)
3. ✅ Multi-source configuration loading
4. ✅ All existing CLI commands (rooms, messages, WebSocket)

---

## Future Enhancements (Optional)

1. **Backend Spawner Service**: Dedicated service for managing orchestrator lifecycle
2. **Health Checks**: Monitor orchestrator status via WebSocket
3. **Auto-restart**: Restart crashed orchestrators
4. **Resource Limits**: Set memory/CPU limits on spawned instances

---

## Testing

### Manual Testing Checklist

- [ ] `meet-ai` runs Claude Code interactively
- [ ] `meet-ai --help` shows correct commands
- [ ] Configuration loads from env vars
- [ ] Configuration loads from settings.json files
- [ ] Discovery finds Claude in PATH
- [ ] Discovery respects `MEET_AI_CLAUDE_PATH`
- [ ] Standard CLI commands work (create-room, send-message, etc.)

### Unit Tests (Optional)

If needed later:
- Test configuration loading priority
- Test Claude discovery logic
- Test interactive spawning

---

## References

- [Meet AI Skill](/packages/meet-ai-skill/meet-ai/SKILL.md) - Agent team communication protocol
- [Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code)
- Original complex plan: See git history
