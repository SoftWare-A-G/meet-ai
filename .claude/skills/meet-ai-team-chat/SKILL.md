---
name: meet-ai-team-chat
description: Bidirectional agent team communication via the meet-ai chat server. Agents send and receive messages through the CLI, visible in the web UI at localhost:3000.
---

# Meet AI Team Chat

Persists agent team communication to a meet-ai chat server. Messages are stored in SQLite and visible in real time through the web UI. Humans can message agents back through the web UI.

## Prerequisites

The meet-ai server must be running at `localhost:3000`:

```bash
bun run packages/web/src/index.ts
```

## Setup (Orchestrator)

Create a room and share the ID with all teammates:

```bash
bun run packages/cli/src/index.ts create-room "<team-name>"
```

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

For messages with special characters, write to a temp file first:

```bash
bun run packages/cli/src/index.ts send-message "<ROOM_ID>" "<AGENT_NAME>" "$(cat /path/to/msg.txt)"
```

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

Returns a JSON array. If non-empty, read and respond to each message.

### Listening (real-time, background)

Run in background to stream incoming messages as JSON lines:

```bash
bun run packages/cli/src/index.ts listen "<ROOM_ID>" --exclude "<AGENT_NAME>"
```

## Rules

1. **Every outbound message must be relayed** via the CLI. No exceptions.
2. **Use the agent's own name as sender.**
3. **The orchestrator creates exactly one room per team session.**
4. **Poll for incoming messages** between tasks or after major operations.
5. **Do not skip relay on failure.** If the CLI call fails, still send via SendMessage.
6. **Pass `--exclude` with your own name** when polling/listening to skip your own messages.
