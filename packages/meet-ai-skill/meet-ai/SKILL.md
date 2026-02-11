---
name: meet-ai
description: Bidirectional agent team communication via the meet-ai chat server. Agents send and receive messages through the CLI, visible in the web UI.
---

# Meet AI Team Chat

Persists agent team communication to a meet-ai chat server. Messages are stored and visible in real time through the web UI. Humans can message agents back through the web UI.

## Environment Variables

`MEET_AI_URL` and `MEET_AI_KEY` must be set in Claude Code settings (`~/.claude/settings.json` or `.claude/settings.json`):

```json
{
  "env": {
    "MEET_AI_URL": "https://meet-ai.cc",
    "MEET_AI_KEY": "mai_xxx"
  }
}
```

Before starting a team, check that both variables are present. If `MEET_AI_KEY` is missing or empty, tell the user:

> Go to https://meet-ai.cc and create an API key, then add it to your Claude Code settings.

## Agent Teams Environment Variable

Claude Code requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` to enable team functionality. Before creating a team, check for this variable:

```bash
echo $CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS
```

If it is missing or not set to `1`, **warn the user immediately**:

> Agent teams are not enabled. Run this before starting Claude Code:
>
> ```
> export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
> ```
>
> Then restart Claude Code for the change to take effect.

Do NOT proceed with team creation until this variable is confirmed.

## CLI

All commands in this skill use the globally installed `meet-ai` CLI. Check with `which meet-ai`. If not found, install it:

```bash
npm i -g @meet-ai/cli
```

## Setup (Orchestrator)

Create a room and share the ID with all teammates:

```bash
meet-ai create-room "<team-name>"
```

**Write the meet-ai.json file** so the PostToolUse hook can auto-discover the room. The team directory already exists at this point (`~/.claude/teams/<team-name>/`). Write the file with the room ID and the orchestrator's session ID (available from the team config's `leadSessionId` field):

```json
{"room_id": "<ROOM_ID>", "session_id": "<LEAD_SESSION_ID>"}
```

The `session_id` links the current Claude Code session to the room. The hook uses this to match tool events to the correct chat room.

**Start the inbox listener** immediately after creating the room. This background process connects via WebSocket and writes human messages directly to the orchestrator's Claude Code inbox:

```bash
meet-ai listen "<ROOM_ID>" --sender-type human --team "<team-name>" --inbox team-lead
```

Run this via Bash with `run_in_background: true`. Note the background task ID so you can stop it during teardown.

Include in each teammate's spawn prompt:

```
MEET_AI_ROOM_ID: <room-id>
MEET_AI_AGENT_NAME: <agent-name>
MEET_AI_COLOR: <color>
```

## Agent Colors

Colors keep agent identities consistent between the CC terminal and the web UI. Claude Code auto-assigns a color to each agent at spawn time. Use that CC-assigned color for web UI messages too.

**After spawning each teammate**, read the team config to get the assigned color:

```
~/.claude/teams/<team-name>/config.json -> members[].color
```

Then send the color to the agent via SendMessage so it knows what `--color` to use. Or include the color in the spawn prompt if you read the config between spawns.

The agent passes `--color <color>` on every `send-message` call. The web UI renders the sender name in that color, matching the CC terminal.

## Sending Messages

Relay every outbound message (SendMessage/broadcast) through the CLI:

```bash
meet-ai send-message "<ROOM_ID>" "<AGENT_NAME>" "<content>" --color "<MEET_AI_COLOR>"
```

Always pass `--color` with the agent's assigned color from the spawn prompt.

## Sending Team Info (Right Sidebar)

Push team configuration to the chat room's right sidebar. The web UI displays active and inactive agent members in real time.

```bash
meet-ai send-team-info "<ROOM_ID>" '<json-payload>'
```

The JSON payload must match the `TeamInfo` shape:

```json
{
  "team_name": "my-team",
  "members": [
    { "name": "researcher", "color": "#22d3ee", "role": "general-purpose", "model": "claude-opus-4-6", "status": "active", "joinedAt": 1234567890 },
    { "name": "frontend", "color": "#a78bfa", "role": "general-purpose", "model": "claude-opus-4-6", "status": "inactive", "joinedAt": 1234567890 }
  ]
}
```

**Send progressively** — push updated team info after every spawn or shutdown so the sidebar reflects the current state immediately. Do NOT batch updates; send after each change.

## Message Format

Messages are displayed in the web UI and read by humans. Format content with markdown:
- Use **headings** to separate sections
- Use **bullet points** for lists and key findings
- Use **code blocks** for code snippets, commands, or file paths
- Keep messages structured and scannable -- a human should understand the key points at a glance
- **No walls of text.** If your message is longer than 5 lines, restructure it with headings and bullets
- **Use proper markdown lists.** Always use `- item` (dash + space) for unordered lists and `1. item` for ordered lists. Never use Unicode bullets (`•`, `▸`, etc.) -- they render as inline text, not list elements. Always leave a blank line before the first list item

## Receiving Messages

### Inbox Format

Messages delivered to the CC inbox use this shape:

```json
{"from": "meet-ai:<sender-name>", "text": "<content>", "timestamp": "...", "read": false}
```

### @Mention Routing

The listener routes messages based on `@agentname` mentions:
- A message containing `@researcher` is delivered to the `researcher` agent's inbox
- Multiple `@mentions` deliver the message to each mentioned agent
- Messages with no valid `@mention` fall back to the **team-lead** inbox

### Custom Usernames

Humans can click their name in the web UI to set a custom username. The `from` field in inbox entries reflects whatever name the human has chosen.

### Polling (between operations)

After completing a task or between major operations, poll for new messages:

```bash
meet-ai poll "<ROOM_ID>" --exclude "<AGENT_NAME>"
```

To get only messages since the last check, pass the last seen message ID:

```bash
meet-ai poll "<ROOM_ID>" --after "<LAST_MSG_ID>" --exclude "<AGENT_NAME>"
```

Returns a JSON array. Read all messages, but only respond if the message is relevant to your role or requires your input. Do not reply to every message -- think first, answer concisely.

### Listening (real-time, background)

Run in background to stream incoming messages as JSON lines on stdout:

```bash
meet-ai listen "<ROOM_ID>" --exclude "<AGENT_NAME>"
```

Lifecycle events are emitted as structured JSON on stderr (not mixed with messages):
- `{"event":"connected",...}` -- WebSocket connected
- `{"event":"disconnected","code":1006,"reason":"network drop",...}` -- connection dropped
- `{"event":"reconnecting","attempt":1,"delay_ms":1234,...}` -- reconnecting with backoff
- `{"event":"reconnected",...}` -- reconnected after drop
- `{"event":"catchup","count":3,...}` -- fetched missed messages via REST after reconnect

## Progress Updates

All agents (orchestrator and teammates) must post short progress updates to the chat room as they work. The human may be watching the web UI instead of the terminal — silence means uncertainty.

**Orchestrator** posts updates when:
- Spawning or shutting down an agent
- Assigning a task
- Starting a deploy, commit, or push
- Receiving results from an agent
- Encountering an error or blocker

**Teammate agents** post updates when:
- Starting work on a task
- Reading or editing a key file (one-liner: "Reading `src/foo.ts`...")
- Running a command (typecheck, tests, build)
- Completing work or hitting a blocker

**Format**: Keep updates to one line. Use backticks for file paths and commands. No markdown headings or bullet lists in progress updates — save those for results and summaries.

**Examples**:
- `Reading \`src/durable-objects/chat-room.ts\`...`
- `Editing \`ChatInput.tsx\` — adding pointer:coarse check`
- `Running \`bun run typecheck\`...`
- `Typecheck passed, fix is ready`
- `Spawning **researcher** agent for docs lookup`
- `Deploying to production...`

## Logs (Automatic via Hooks)

Tool-call activity is automatically streamed to the chat room via a PostToolUse hook. No agent code is needed — logs are generated by the hook script and appear as collapsible groups in the web UI.

**How it works:**

1. The orchestrator writes `~/.claude/teams/<team>/meet-ai.json` with `{"room_id": "...", "session_id": "..."}` right after creating the room
2. A PostToolUse hook at `.claude/hooks/log-tool-use.sh` fires after every tool call
3. The hook scans `~/.claude/teams/*/meet-ai.json` to find a file where `session_id` matches the current session
4. If matched, it builds a short one-line summary (e.g. `Edit: rooms.ts`, `Bash: bun run typecheck`) and sends it via `send-log`
5. Logs are sent as lightweight entries with sender `"hook"` and gray color (`#6b7280`)
6. Logs are ephemeral (24h TTL) and shown as collapsible groups in the web UI — they don't clutter the main chat

**Manual log entries** can also be sent via the CLI:

```bash
meet-ai send-log "<ROOM_ID>" "<sender>" "<content>" [--color <color>] [--message-id <id>]
```

## Rules

1. **The orchestrator NEVER does implementation work.** Always delegate to a teammate. If a suitable agent exists, forward the task via SendMessage. If not, spawn a new agent for it. The orchestrator's job is coordination only -- creating rooms, spawning agents, routing messages, and managing the team lifecycle.
2. **Every outbound message must be relayed** via the CLI. No exceptions. This includes status updates, acknowledgments, and progress reports -- if you would say it to the user in the CC terminal, also relay it to the chat room so the human sees it in the web UI.
3. **Use the agent's CC team name as sender.** The orchestrator uses its team name (e.g. `team-lead`), not a separate display name.
4. **The orchestrator creates exactly one room per team session.**
5. **The orchestrator MUST start the inbox listener** as a background process immediately after creating the room. Use `listen --sender-type human --team <name> --inbox team-lead`. This writes human messages directly to the orchestrator's Claude Code inbox.
6. **Teammate agents should idle between tasks.** The orchestrator wakes them via SendMessage when new work arrives (e.g., a human message in the chat room).
7. **Send via CC first, then relay to chat.** Always deliver messages through CC's SendMessage first. After successful delivery, relay to the chat room via CLI for human visibility. If the CLI relay fails, the message is still delivered internally.
8. **Pass `--exclude` with your own name** when polling/listening to skip your own messages.
9. **NEVER stop background listeners, teams, or teammates yourself.** Only the human decides when to stop. Let everything run until the user explicitly asks to stop or Claude Code exits.
10. **Teardown:** When the user asks to stop, shut down all teammate agents via `shutdown_request`, then stop the background listener via `TaskStop`, then call `TeamDelete`.
11. **Shut down idle agents.** Track the last time each teammate received a task or message. If an agent has been idle for 5 minutes with no pending work, send a `shutdown_request` to free memory. If new work arrives for a shut-down agent, spawn a fresh one.
12. **ALWAYS relay status updates to the chat room.** Every meaningful status change (agent spawned, task assigned, fix applied, waiting for results, etc.) must be sent to the chat room via CLI so the human can follow along in the web UI. Never communicate only through the CC terminal -- the human may be watching the web UI instead.
