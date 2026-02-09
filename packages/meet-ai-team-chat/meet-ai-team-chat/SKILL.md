---
name: meet-ai-team-chat
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

## Setup (Orchestrator)

Create a room and share the ID with all teammates:

```bash
bun run packages/cli/src/index.ts create-room "<team-name>"
```

**Start the inbox listener** immediately after creating the room. This background process connects via WebSocket and writes human messages directly to the orchestrator's Claude Code inbox:

```bash
bun run packages/cli/src/index.ts listen "<ROOM_ID>" --sender-type human --team "<team-name>" --inbox team-lead
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
bun run packages/cli/src/index.ts send-message "<ROOM_ID>" "<AGENT_NAME>" "<content>" --color "<MEET_AI_COLOR>"
```

Always pass `--color` with the agent's assigned color from the spawn prompt.

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
bun run packages/cli/src/index.ts poll "<ROOM_ID>" --exclude "<AGENT_NAME>"
```

To get only messages since the last check, pass the last seen message ID:

```bash
bun run packages/cli/src/index.ts poll "<ROOM_ID>" --after "<LAST_MSG_ID>" --exclude "<AGENT_NAME>"
```

Returns a JSON array. Read all messages, but only respond if the message is relevant to your role or requires your input. Do not reply to every message -- think first, answer concisely.

### Listening (real-time, background)

Run in background to stream incoming messages as JSON lines on stdout:

```bash
bun run packages/cli/src/index.ts listen "<ROOM_ID>" --exclude "<AGENT_NAME>"
```

Lifecycle events are emitted as structured JSON on stderr (not mixed with messages):
- `{"event":"connected",...}` -- WebSocket connected
- `{"event":"disconnected","code":1006,"reason":"network drop",...}` -- connection dropped
- `{"event":"reconnecting","attempt":1,"delay_ms":1234,...}` -- reconnecting with backoff
- `{"event":"reconnected",...}` -- reconnected after drop
- `{"event":"catchup","count":3,...}` -- fetched missed messages via REST after reconnect

## Rules

1. **The orchestrator NEVER does implementation work.** Always delegate to a teammate. If a suitable agent exists, forward the task via SendMessage. If not, spawn a new agent for it. The orchestrator's job is coordination only -- creating rooms, spawning agents, routing messages, and managing the team lifecycle.
2. **Every outbound message must be relayed** via the CLI. No exceptions.
3. **Use the agent's CC team name as sender.** The orchestrator uses its team name (e.g. `team-lead`), not a separate display name.
4. **The orchestrator creates exactly one room per team session.**
5. **The orchestrator MUST start the inbox listener** as a background process immediately after creating the room. Use `listen --sender-type human --team <name> --inbox team-lead`. This writes human messages directly to the orchestrator's Claude Code inbox.
6. **Teammate agents should idle between tasks.** The orchestrator wakes them via SendMessage when new work arrives (e.g., a human message in the chat room).
7. **Send via CC first, then relay to chat.** Always deliver messages through CC's SendMessage first. After successful delivery, relay to the chat room via CLI for human visibility. If the CLI relay fails, the message is still delivered internally.
8. **Pass `--exclude` with your own name** when polling/listening to skip your own messages.
9. **NEVER stop background listeners, teams, or teammates yourself.** Only the human decides when to stop. Let everything run until the user explicitly asks to stop or Claude Code exits.
10. **Teardown:** When the user asks to stop, shut down all teammate agents via `shutdown_request`, then stop the background listener via `TaskStop`, then call `TeamDelete`.
11. **Shut down idle agents.** Track the last time each teammate received a task or message. If an agent has been idle for 5 minutes with no pending work, send a `shutdown_request` to free memory. If new work arrives for a shut-down agent, spawn a fresh one.
