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

**Start the WebSocket listener immediately** after creating the room. Run it in the background so the orchestrator stays connected at all times:

```bash
bun run packages/cli/src/index.ts listen "<ROOM_ID>" --exclude "orchestrator"
```

Run this via Bash with `run_in_background: true`. The orchestrator MUST stay connected via WebSocket for the entire session. This allows:
- Instant delivery of human messages from the web UI
- Agents to remain idle until the orchestrator wakes them with a SendMessage
- No manual polling needed — messages stream in automatically

Include in each teammate's spawn prompt:

```
MEET_AI_ROOM_ID: <room-id>
MEET_AI_AGENT_NAME: <agent-name>
```

## Sending Messages

Relay every outbound message (SendMessage/broadcast) through the CLI:

```bash
bun run packages/cli/src/index.ts send-message "<ROOM_ID>" "<AGENT_NAME>" "<content>"
```

## Message Format

Messages are displayed in the web UI and read by humans. Format content with markdown:
- Use **headings** to separate sections
- Use **bullet points** for lists and key findings
- Use **code blocks** for code snippets, commands, or file paths
- Keep messages structured and scannable — a human should understand the key points at a glance
- **No walls of text.** If your message is longer than 5 lines, restructure it with headings and bullets

## Receiving Messages

### Polling (between operations)

After completing a task or between major operations, poll for new messages:

```bash
bun run packages/cli/src/index.ts poll "<ROOM_ID>" --exclude "<AGENT_NAME>"
```

To get only messages since the last check, pass the last seen message ID:

```bash
bun run packages/cli/src/index.ts poll "<ROOM_ID>" --after "<LAST_MSG_ID>" --exclude "<AGENT_NAME>"
```

Returns a JSON array. Read all messages, but only respond if the message is relevant to your role or requires your input. Do not reply to every message — think first, answer concisely.

### Listening (real-time, background)

Run in background to stream incoming messages as JSON lines on stdout:

```bash
bun run packages/cli/src/index.ts listen "<ROOM_ID>" --exclude "<AGENT_NAME>"
```

Lifecycle events are emitted as structured JSON on stderr (not mixed with messages):
- `{"event":"connected",...}` — WebSocket connected
- `{"event":"disconnected","code":1006,"reason":"network drop",...}` — connection dropped
- `{"event":"reconnecting","attempt":1,"delay_ms":1234,...}` — reconnecting with backoff
- `{"event":"reconnected",...}` — reconnected after drop
- `{"event":"catchup","count":3,...}` — fetched missed messages via REST after reconnect

## Rules

1. **Every outbound message must be relayed** via the CLI. No exceptions.
2. **Use the agent's own name as sender.**
3. **The orchestrator creates exactly one room per team session.**
4. **The orchestrator MUST stay connected via WebSocket** using `listen` in the background for the entire session. Do NOT rely on periodic polling — use the live connection to receive messages instantly and wake idle agents when needed.
5. **Teammate agents should idle between tasks.** The orchestrator wakes them via SendMessage when new work arrives (e.g., a human message in the chat room).
6. **Do not skip relay on failure.** If the CLI call fails, still send via SendMessage.
7. **Pass `--exclude` with your own name** when polling/listening to skip your own messages.
8. **NEVER stop background listeners, teams, or teammates yourself.** Only the human decides when to stop. Let everything run until the user explicitly asks to stop or Claude Code exits.
