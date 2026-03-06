# Hook-Based Automatic Team Info Updates

**Date:** 2026-03-06
**Status:** Draft

## Overview

Replace the manual `meet-ai send-team-info <room_id> '<full JSON>'` approach with automatic, incremental team info updates triggered by PostToolUse hooks. When an agent is spawned or shuts down, the hook detects the lifecycle event from the tool response and sends an **upsert** (single-member update) to the server, which merges it into the existing team info.

### Current Problems

1. **Manual & unreliable** — The orchestrator must remember to call `send-team-info` after every spawn/shutdown.
2. **Full-replace semantics** — The entire team array is sent every time, requiring the orchestrator to maintain the full state.
3. **Orchestrator-only** — Only the lead agent can update team info; individual agents can't update their own status.
4. **Race conditions** — If two agents spawn concurrently and the orchestrator sends two full-replace calls, the second overwrites the first.

### Solution: Incremental Upsert via Hooks

The `log-tool-use` PostToolUse hook already runs on every tool call. Extend it to detect:

1. **Agent spawned** — `tool_name === "Agent"` and response contains `status === "teammate_spawned"`
2. **Agent shutdown** — `tool_name === "SendMessage"` and input contains `type === "shutdown_response"` with `approve === true`

On detection, send a **PATCH** (upsert) to a new API endpoint that merges a single member into the existing team info, rather than replacing the whole array.

---

## Data Flow

```
Claude Code Agent
    │
    ├─ PostToolUse hook fires
    │   (stdin: { tool_name, tool_input, tool_response, session_id, ... })
    │
    ├─ log-tool-use/usecase.ts detects lifecycle event
    │
    ├─ Extracts member info from tool_input/tool_response
    │
    ├─ Calls: PATCH /api/rooms/:id/team-info/members
    │   Body: { member: TeamMember }
    │
    └─ Worker receives PATCH
        │
        ├─ Forwards to ChatRoom DO: /team-info/upsert
        │
        ├─ DO merges member into existing teamInfo
        │   (insert if new, update if name matches)
        │
        ├─ Persists to storage + broadcasts via WebSocket
        │
        └─ UI receives updated team_info event (no changes needed)
```

---

## Detailed Steps

### 1. Worker API — New Upsert Endpoint

**File:** `packages/worker/src/routes/rooms.ts`

Add a new route alongside the existing `POST /:id/team-info`:

```
PATCH /api/rooms/:id/team-info/members
```

**Request body:**
```json
{
  "team_name": "my-team",
  "member": {
    "teammate_id": "abc123-def456",
    "name": "plan-writer",
    "color": "#818cf8",
    "role": "teammate",
    "model": "claude-opus-4-6",
    "status": "active",
    "joinedAt": 1741257600000
  }
}
```

**Response:** `{ "ok": true }`

**Schema changes** (in `packages/worker/src/schemas/rooms.ts`):

Add `teammate_id` to the existing `teamInfoMemberSchema`:

```ts
export const teamInfoMemberSchema = z.object({
  teammate_id: z.string(),
  name: z.string(),
  color: z.string(),
  role: z.string(),
  model: z.string(),
  status: z.enum(['active', 'inactive']),
  joinedAt: z.number(),
})
```

Add a new upsert schema:

```ts
export const teamInfoUpsertSchema = z.object({
  team_name: z.string(),
  member: teamInfoMemberSchema,
})
```

**Route handler logic:**
1. Auth + room ownership check (same as existing team-info route)
2. Forward to ChatRoom DO at `/team-info/upsert`
3. Return `{ ok: true }`

### 2. Durable Object — Upsert Handler

**File:** `packages/worker/src/durable-objects/chat-room.ts`

Add a new path handler in the `fetch()` method:

```ts
// /team-info/upsert — merge a single member into team info
if (url.pathname === '/team-info/upsert') {
  const body = JSON.parse(await request.text())
  const { team_name, member } = body

  // Load existing team info
  if (!this.teamInfo) {
    this.teamInfo = (await this.ctx.storage.get<string>('teamInfo')) ?? null
  }

  const current = this.teamInfo
    ? JSON.parse(this.teamInfo)
    : { type: 'team_info', team_name, members: [] }

  // Update team_name if provided
  if (team_name) current.team_name = team_name

  // Upsert: find by teammate_id, replace or append
  const members: TeamMember[] = current.members ?? []
  const idx = members.findIndex((m: any) => m.teammate_id === member.teammate_id)
  if (idx !== -1) {
    members[idx] = { ...members[idx], ...member }
  } else {
    members.push(member)
  }
  current.members = members

  const payload = JSON.stringify(current)
  this.teamInfo = payload
  await this.ctx.storage.put('teamInfo', payload)

  // Broadcast to all WS clients
  for (const ws of this.ctx.getWebSockets()) {
    try { ws.send(payload) } catch { /* client gone */ }
  }

  return new Response('ok')
}
```

### 3. CLI Hook Client — Add Upsert Method

**File:** `packages/cli/src/lib/hooks/client.ts`

The hook client already uses `hc<AppType>()` from hono/client (see `createHookClient()`). Once the PATCH route is added to the worker's Hono app (Step 1), the `hc()` client automatically gets type-safe access to it.

Add a new function that follows the same pattern as `sendLogEntry()`:

```ts
export async function sendTeamMemberUpsert(
  client: HookClient,
  roomId: string,
  teamName: string,
  member: {
    teammate_id: string
    name: string
    color: string
    role: string
    model: string
    status: 'active' | 'inactive'
    joinedAt: number
  },
): Promise<void> {
  try {
    await client.api.rooms[':id']['team-info'].members.$patch({
      param: { id: roomId },
      json: { team_name: teamName, member },
    })
  } catch {
    // Never throw — hook must not block the agent
  }
}
```

### 4. Hook Logic — Detect Agent Lifecycle Events

**File:** `packages/cli/src/commands/hook/log-tool-use/usecase.ts`

Extend `processHookInput()` to detect spawns and shutdowns **before** the normal log-entry flow:

#### 4a. Detect Agent Spawn

```ts
// After parsing input, before the existing log flow:

if (toolName === 'Agent' && toolResponse) {
  const status = toolResponse.status as string | undefined
  if (status === 'teammate_spawned') {
    // All fields verified from tools-logs/agent/*.json
    const teammateId = toolResponse.teammate_id as string  // e.g. "philosopher@expressive-rolling-thacker"
    const name = toolResponse.name as string                // e.g. "philosopher"
    const color = toolResponse.color as string              // e.g. "purple" (CC color name, not hex)
    const model = toolResponse.model as string              // e.g. "claude-opus-4-6"
    const agentType = toolResponse.agent_type as string     // e.g. "general-purpose"
    const teamName = toolResponse.team_name as string       // e.g. "expressive-rolling-thacker"

    await sendTeamMemberUpsert(client, roomId, teamName, {
      teammate_id: teammateId,
      name,
      color,
      role: agentType || 'teammate',
      model: model || 'unknown',
      status: 'active',
      joinedAt: Date.now(),
    })
    // Continue to also send the normal log entry
  }
}
```

#### 4b. Detect Agent Shutdown

```ts
if (toolName === 'SendMessage') {
  const inputType = toolInput.type as string | undefined
  const approve = toolInput.approve as boolean | undefined

  if (inputType === 'shutdown_response' && approve === true) {
    const requestId = toolInput.request_id as string | undefined
    // Verified from tools-logs/sendmessage/1772812532043.json
    // request_id format: "shutdown-<timestamp>@<agent-name>" e.g. "shutdown-1772812517782@diff-theme"
    const agentName = requestId?.split('@')[1]

    if (agentName) {
      // Get team_name and teammate_id from team config or transcript
      const room = await findRoom(sessionId, teamsDir, transcriptPath)
      const teamName = room?.teamName || ''
      // teammate_id format: "<name>@<team-name>"
      const teammateId = teamName ? `${agentName}@${teamName}` : agentName

      await sendTeamMemberUpsert(client, roomId, teamName, {
        teammate_id: teammateId,
        name: agentName,
        color: '#555',
        role: 'teammate',
        model: 'unknown',
        status: 'inactive',
        joinedAt: 0,  // Will be preserved by upsert merge
      })
    }
    // Continue to also send the normal log entry
  }
}
```

**Note on `joinedAt: 0`:** The upsert merge uses spread (`{ ...existing, ...update }`), so we need to handle this. Two options:
- A) Server ignores falsy `joinedAt` during merge (preferred)
- B) Client sends `joinedAt: Date.now()` and server preserves existing value

**Recommendation:** Option A — the DO upsert handler should merge selectively:
```ts
if (idx !== -1) {
  // Only update fields that are meaningfully set
  const updated = { ...members[idx] }
  if (member.status) updated.status = member.status
  if (member.color && member.color !== '#555') updated.color = member.color
  if (member.model && member.model !== 'unknown') updated.model = member.model
  if (member.role) updated.role = member.role
  if (member.joinedAt > 0) updated.joinedAt = member.joinedAt
  if (member.name) updated.name = member.name
  members[idx] = updated
}
```

### 5. Extract Team Name Helper

The hook needs `team_name` for the upsert payload. This is already partially available via `findRoomId()` which scans `~/.claude/teams/*/meet-ai.json`. We need to also extract the team name.

**File:** `packages/cli/src/lib/hooks/find-room.ts`

Add a new export or modify `findRoomId` to return both room_id and team_name:

```ts
export type RoomLookupResult = {
  roomId: string
  teamName: string
}

export async function findRoom(
  sessionId: string,
  teamsDir?: string,
  transcriptPath?: string
): Promise<RoomLookupResult | null> {
  // Same logic as findRoomId but returns { roomId, teamName }
  // The team directory name IS the team name
}
```

Keep `findRoomId` as a wrapper for backward compatibility:
```ts
export async function findRoomId(...args): Promise<string | null> {
  const result = await findRoom(...args)
  return result?.roomId ?? null
}
```

### 6. tool_response Shape Reference

Verified from actual PostToolUse payloads in `tools-logs/`.

#### Agent Spawn (`tools-logs/agent/1772805418301.json`)

`tool_response` contains all fields needed for upsert:

```json
{
  "status": "teammate_spawned",
  "teammate_id": "philosopher@expressive-rolling-thacker",
  "agent_id": "philosopher@expressive-rolling-thacker",
  "agent_type": "general-purpose",
  "model": "claude-opus-4-6",
  "name": "philosopher",
  "color": "purple",
  "team_name": "expressive-rolling-thacker",
  "tmux_session_name": "current",
  "tmux_window_name": "current",
  "tmux_pane_id": "%12",
  "is_splitpane": true,
  "plan_mode_required": false
}
```

**Key fields for upsert:**
- `teammate_id` — unique identifier (format: `<name>@<team-name>`), used as upsert key
- `name`, `color`, `model`, `agent_type`, `team_name` — all directly available

#### Agent Shutdown (`tools-logs/sendmessage/1772812532043.json`)

`tool_name: "SendMessage"`, `tool_input`:

```json
{
  "type": "shutdown_response",
  "request_id": "shutdown-1772812517782@diff-theme",
  "approve": true
}
```

**For shutdown upsert**, extract agent name from `request_id` (format: `shutdown-<timestamp>@<agent-name>`). The `session_id` from the hook input identifies the orchestrator session. To get the full `teammate_id` and other agent metadata:
- Read team config at `~/.claude/teams/<team-name>/config.json` → `members[]` to find the agent by name
- Or read the file at `transcript_path` (from the hook's stdin payload) and parse its first line, which contains agent session metadata

---

## Migration Strategy

### Phase 1: Add Upsert Endpoint (Non-Breaking)

1. Add `PATCH /api/rooms/:id/team-info/members` to the worker
2. Add `/team-info/upsert` to the ChatRoom DO
3. Add `sendTeamMemberUpsert()` to hook client
4. Deploy worker

**The existing `POST /api/rooms/:id/team-info` (full-replace) continues to work unchanged.**

### Phase 2: Add Hook Detection

1. Extend `processHookInput()` in log-tool-use to detect spawn/shutdown events
2. Add `findRoom()` helper that returns both roomId and teamName
3. Publish new CLI version
4. Run `meet-ai setup-hooks` to ensure hooks are up to date

### Phase 3: Deprecate Full-Replace API (Future)

1. Deprecate `POST /api/rooms/:id/team-info` (full-replace) API endpoint
2. Remove manual `send-team-info` instructions from SKILL.md (`packages/meet-ai-skill/meet-ai/SKILL.md`)
3. Update MEMORY.md rules to remove manual team-info references
4. The full-replace endpoint stays available indefinitely as a reset mechanism
5. Optionally: add a `meet-ai send-team-info --member <json>` CLI command that uses the upsert endpoint

---

## File-by-File Change List

### `packages/worker/src/schemas/rooms.ts`
- **Add** `teamInfoUpsertSchema` (reuses existing `teamInfoMemberSchema`)
- ~5 lines

### `packages/worker/src/routes/rooms.ts`
- **Add** `PATCH /:id/team-info/members` route handler
- ~20 lines

### `packages/worker/src/durable-objects/chat-room.ts`
- **Add** `/team-info/upsert` path handler with merge logic
- ~30 lines

### `packages/cli/src/lib/hooks/client.ts`
- **Add** `sendTeamMemberUpsert()` function (raw fetch, no hono client dependency)
- **Add** `TeamMemberPayload` type
- ~25 lines

### `packages/cli/src/lib/hooks/find-room.ts`
- **Add** `RoomLookupResult` type and `findRoom()` function
- **Refactor** `findRoomId()` to wrap `findRoom()`
- ~15 lines changed

### `packages/cli/src/lib/hooks/index.ts`
- **Add** exports for `sendTeamMemberUpsert`, `findRoom`, `RoomLookupResult`
- ~3 lines

### `packages/cli/src/commands/hook/log-tool-use/usecase.ts`
- **Add** spawn detection block (~15 lines)
- **Add** shutdown detection block (~20 lines)
- **Import** `sendTeamMemberUpsert` and `findRoom`
- ~40 lines total

### Tests

#### `packages/worker/test/api.test.ts`
- **Add** test for `PATCH /api/rooms/:id/team-info/members` (upsert new member)
- **Add** test for upsert existing member (status change)
- **Add** test for upsert preserves other members
- ~40 lines

#### `packages/cli/src/commands/hook/log-tool-use/usecase.test.ts` (new or extend)
- **Add** test for spawn detection (Agent tool with teammate_spawned)
- **Add** test for shutdown detection (SendMessage with shutdown_response)
- **Add** test for non-matching tools are ignored
- ~50 lines

---

## Total Estimated Changes

| Package | Lines Added/Changed |
|---------|-------------------|
| Worker schemas | ~5 |
| Worker routes | ~20 |
| Worker DO | ~30 |
| CLI hook client | ~25 |
| CLI find-room | ~15 |
| CLI hook index | ~3 |
| CLI log-tool-use | ~40 |
| Tests | ~90 |
| **Total** | **~228** |

---

## Resolved Questions

1. ~~**What does `tool_response` contain for Agent spawns?**~~ **RESOLVED** — verified from `tools-logs/agent/*.json`. All fields (`teammate_id`, `name`, `color`, `model`, `agent_type`, `team_name`) are directly available in `tool_response`.

2. ~~**Should agents self-report?**~~ **No.** Hook detection on the orchestrator's PostToolUse is sufficient.

3. ~~**Team name source:**~~ **Not an issue.** The orchestrator always creates a team first (with itself only), then connects to the meet-ai room, then spawns agents. The `meet-ai.json` file exists before any agent spawn.

4. ~~**Rate limits:**~~ **No rate limits** on the upsert endpoint.
