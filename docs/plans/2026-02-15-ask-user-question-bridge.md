# AskUserQuestion Bridge: Claude Code to meet-ai Web UI

**Date:** 2026-02-15
**Status:** Plan (not implemented)

## Overview

Bridge the Claude Code `AskUserQuestion` tool to the meet-ai web UI as an interactive message type. When an agent calls `AskUserQuestion`, the question appears as an interactive card in the chat. The human clicks an option, and the response flows back to the agent.

---

## 1. Message Type Design

### New message type: `AskUserQuestion`

The `type` column in the `messages` table already supports arbitrary text values (`DEFAULT 'message'`). We add a new type value `AskUserQuestion` — no schema change needed for the type itself.

### Payload schema

The question payload is stored as **structured JSON in the `content` column**. This avoids adding new columns and keeps the existing message flow intact.

```typescript
// Stored in messages.content as JSON string
type AskUserQuestionPayload = {
  question: string           // The main question text
  options: AskOption[]       // Selectable options
  multiSelect?: boolean      // Allow multiple selections (default: false)
  header?: string            // Optional header/title above the question
}

type AskOption = {
  label: string              // Short label shown on the button
  description?: string       // Optional description below the label
}
```

Example `content` value:
```json
{
  "question": "Which approach should I use for the refactor?",
  "header": "Design Decision",
  "options": [
    { "label": "Option A", "description": "Keep the current architecture, just clean up" },
    { "label": "Option B", "description": "Full rewrite with new patterns" },
    { "label": "Option C", "description": "Incremental migration" }
  ],
  "multiSelect": false
}
```

### Storage

- **Same `messages` table** — uses `type = 'AskUserQuestion'`
- **Content column** — JSON-encoded `AskUserQuestionPayload`
- **Color column** — agent's color (as with regular messages)
- **Sender column** — agent name
- No new columns needed

### Broadcast

Broadcast works identically to regular messages — the full message object (including `type: 'AskUserQuestion'`) is sent through the ChatRoom DO `/broadcast` endpoint. The client distinguishes rendering based on `type`.

---

## 2. Response Design

### Response message type: `AskUserQuestionResponse`

When the human selects an option (or options), a **new message** is created with `type = 'AskUserQuestionResponse'`.

```typescript
// Stored in messages.content as JSON string
type AskUserQuestionResponsePayload = {
  questionMessageId: string   // ID of the original AskUserQuestion message
  selectedOptions: string[]   // Array of selected option labels
}
```

The response is sent as a regular POST to `/api/rooms/:id/messages` with:
- `sender`: the human's username
- `sender_type`: `'human'`
- `type`: `'AskUserQuestionResponse'`
- `content`: JSON-encoded `AskUserQuestionResponsePayload`

### Why a separate type (not a regular message)?

1. The agent's `poll`/`listen` can filter for `AskUserQuestionResponse` messages to find answers
2. The UI can render it distinctly (showing "Selected: Option A" rather than raw JSON)
3. The original question card can cross-reference the response to show the selected state

---

## 3. API Changes

### POST /api/rooms/:id/messages — extend type support

Currently the route hardcodes `type: 'message'` in the broadcast payload. Change to accept an optional `type` field in the request body:

```typescript
// In rooms.ts POST handler
const body = await c.req.json<{
  sender?: string
  content?: string
  sender_type?: string
  color?: string
  type?: string                    // NEW: 'message' | 'AskUserQuestion' | 'AskUserQuestionResponse'
  attachment_ids?: string[]
}>()

// Whitelist allowed types
const ALLOWED_TYPES = new Set(['message', 'AskUserQuestion', 'AskUserQuestionResponse'])
const messageType = body.type && ALLOWED_TYPES.has(body.type) ? body.type : 'message'
```

Pass `messageType` to `insertMessage()` and include it in the broadcast payload.

**No new routes needed.** The existing messages endpoint handles everything.

---

## 4. CLI Command

### New command: `send-ask-question`

```
meet-ai send-ask-question <roomId> <sender> '<json-payload>' [--color <color>]
```

Where `<json-payload>` is the `AskUserQuestionPayload` JSON.

**Example:**
```bash
meet-ai send-ask-question "$ROOM_ID" "my-agent" \
  '{"question":"Which approach?","options":[{"label":"A"},{"label":"B"}]}' \
  --color "#818cf8"
```

**Implementation in `packages/cli/src/index.ts`:**

```typescript
case "send-ask-question": {
  const { positional, flags } = parseFlags(args);
  const [roomId, sender, payload] = positional;
  if (!roomId || !sender || !payload) {
    console.error("Usage: cli send-ask-question <roomId> <sender> '<json>' [--color <color>]");
    process.exit(1);
  }
  // Validate JSON
  let parsed;
  try {
    parsed = JSON.parse(payload);
  } catch {
    console.error("Error: payload must be valid JSON");
    process.exit(1);
  }
  if (!parsed.question || !Array.isArray(parsed.options)) {
    console.error("Error: payload must have 'question' and 'options' fields");
    process.exit(1);
  }
  const msg = await client.sendMessage(roomId, sender, payload, flags.color);
  // ^ Need to extend client.sendMessage to accept optional type parameter
  console.log(`Question sent: ${msg.id}`);
  break;
}
```

**Client changes (`packages/cli/src/client.ts`):**

Extend `sendMessage` to accept an optional `type` parameter:

```typescript
async sendMessage(roomId: string, sender: string, content: string, color?: string, type?: string) {
  // ...existing code...
  body: JSON.stringify({
    sender,
    content,
    sender_type: 'agent',
    ...(color && { color }),
    ...(type && { type }),     // NEW
  }),
}
```

### Polling for responses

Agents already use `poll` or `listen` to receive messages. The response arrives as a regular message with `type: 'AskUserQuestionResponse'`. The agent can:

1. Use `poll` with the existing `--after` flag to get messages after the question was sent
2. Use `listen` which streams all messages in real-time
3. Parse the JSON content to extract `selectedOptions`

No new CLI commands needed for receiving responses.

---

## 5. Web UI Rendering

### AskUserQuestion card in MessageList

In `MessageList.tsx`, the `groupMessages` function needs to handle `AskUserQuestion` type messages. They should render as a distinct `AskQuestionCard` component instead of a regular `Message`.

**New component: `AskQuestionCard.tsx`**

```
packages/worker/src/app/components/AskQuestionCard/AskQuestionCard.tsx
```

#### Layout:

```
+--------------------------------------------------+
|  [agent-name]                          [timestamp] |
|                                                    |
|  [header if present]                               |
|  Question text here?                               |
|                                                    |
|  +----------------------------------------------+ |
|  | Option A                                      | |
|  | Optional description text                     | |
|  +----------------------------------------------+ |
|  +----------------------------------------------+ |
|  | Option B                                      | |
|  | Optional description text                     | |
|  +----------------------------------------------+ |
|  +----------------------------------------------+ |
|  | Option C                                      | |
|  | Optional description text                     | |
|  +----------------------------------------------+ |
|                                                    |
+--------------------------------------------------+
```

#### Styling:

- Distinct background: slightly elevated card with a subtle left border in the agent's color
- Options: rendered as clickable buttons/cards with hover state
- Selected state: after answering, the selected option gets a checkmark and highlighted border; unselected options are dimmed
- Disabled state: all options become non-interactive after submission
- Multi-select: checkboxes instead of radio-style buttons; a "Submit" button appears below the options

#### States:

1. **Unanswered** — options are clickable, hover effects active
2. **Answered** — selected option(s) highlighted, others dimmed, "Answered" badge shown
3. **Answered by someone else** — same as answered, but shows who answered

#### How to detect "answered" state:

When the `MessageList` renders, scan messages for any `AskUserQuestionResponse` whose `questionMessageId` matches this question's `id`. If found, extract `selectedOptions` and render in answered state.

**Props:**

```typescript
type AskQuestionCardProps = {
  messageId: string
  sender: string
  color?: string
  timestamp?: string
  payload: AskUserQuestionPayload
  answeredOptions?: string[]      // From matching response message, if any
  answeredBy?: string             // Sender of the response
  onAnswer: (selectedOptions: string[]) => void
  disabled?: boolean              // True if already answered
}
```

### Changes to MessageList.tsx

In the `groupMessages` function and render loop:

```typescript
// In the render loop, check message type
if (msg.type === 'AskUserQuestion') {
  const payload = JSON.parse(msg.content) as AskUserQuestionPayload
  // Find matching response
  const response = messages.find(m =>
    m.type === 'AskUserQuestionResponse' &&
    JSON.parse(m.content).questionMessageId === msg.id
  )
  return (
    <AskQuestionCard
      key={...}
      messageId={msg.id!}
      sender={msg.sender}
      color={msg.color}
      timestamp={msg.created_at}
      payload={payload}
      answeredOptions={response ? JSON.parse(response.content).selectedOptions : undefined}
      answeredBy={response?.sender}
      onAnswer={handleAnswer}
      disabled={!!response}
    />
  )
}
```

### Changes to ChatView.tsx

Add a `handleAnswer` callback that:
1. Sends a `POST /api/rooms/:id/messages` with `type: 'AskUserQuestionResponse'`
2. Uses the human's username as sender
3. Content is JSON with `{ questionMessageId, selectedOptions }`

```typescript
const handleAnswer = useCallback(async (questionMessageId: string, selectedOptions: string[]) => {
  const content = JSON.stringify({ questionMessageId, selectedOptions })
  await api.sendMessage(room.id, userName, content)
  // The response comes back via WebSocket broadcast and updates the UI
}, [room.id, userName])
```

**Note:** `api.sendMessage` needs to be extended to accept an optional `type` parameter, similar to the CLI client change.

### Changes to client-side types

In `packages/worker/src/app/lib/types.ts`:

```typescript
export type Message = {
  id?: string
  message_id?: string | null
  sender: string
  content: string
  color?: string
  created_at: string
  type?: 'message' | 'log' | 'AskUserQuestion' | 'AskUserQuestionResponse'
  seq?: number | null
  attachment_count?: number
}
```

### AskUserQuestionResponse rendering

Response messages (`type: 'AskUserQuestionResponse'`) should **not** render as standalone messages in the chat. They are consumed by the `AskQuestionCard` to show answered state. Filter them out in `groupMessages`:

```typescript
// In groupMessages, skip response messages (they're shown inline on the question card)
if (msg.type === 'AskUserQuestionResponse') continue
```

---

## 6. Integration Points (Hook — note only)

### PostToolUse hook intercept

The `log-tool-use.sh` hook currently intercepts all tool calls and sends log summaries. For `AskUserQuestion`:

- The hook would need a new case in its `case "$TOOL_NAME"` block
- Instead of sending a log, it would call `meet-ai send-ask-question` with the tool's input payload
- The hook would then need to **block** until a response arrives (fundamentally different from current fire-and-forget behavior)

**This is noted for the future hook rework.** The current hook architecture (PostToolUse, fire-and-forget bash script) cannot support blocking/waiting for responses. The hook rework will need to:

1. Detect `AskUserQuestion` tool calls
2. Extract the question payload from `tool_input`
3. Send via `meet-ai send-ask-question`
4. Poll or listen for the `AskUserQuestionResponse`
5. Return the response to Claude Code (possibly via a PreToolUse hook or a custom mechanism)

### Agent blocking/waiting

When an agent sends an `AskUserQuestion`, it needs to wait for the response. Two approaches:

**A. Poll-based (simpler, recommended for v1):**
The agent calls `meet-ai poll <roomId> --after <questionMessageId>` periodically until it finds an `AskUserQuestionResponse` matching its question ID.

**B. Listen-based (real-time):**
If the agent already has a `listen` process running, the response arrives via WebSocket and gets routed to the agent's inbox.

### Edge cases

- **Timeout:** If the human doesn't answer within N minutes, the agent should proceed with a default or re-ask. This is agent-side logic, not system-enforced.
- **Multiple pending questions:** Each question has a unique message ID, so multiple can coexist. The UI shows each independently.
- **Agent shutdown before answer:** The question persists in the chat. If answered later, the response is stored but no agent picks it up. Stale questions could show a "No longer waiting" indicator if the agent's team-info status changes to inactive.
- **Duplicate answers:** The UI should prevent submitting multiple answers by disabling the card after the first submission. The server doesn't enforce uniqueness — if somehow two responses are sent, the agent sees both via poll.

---

## 7. Database Changes

### No schema migration needed

- The `messages.type` column already accepts arbitrary text (`TEXT NOT NULL DEFAULT 'message'`)
- The `content` column already stores text (JSON fits naturally)
- Both `AskUserQuestion` and `AskUserQuestionResponse` use the existing `messages` table

### Optional future index

If polling for responses becomes slow:
```sql
CREATE INDEX idx_messages_type ON messages(room_id, type) WHERE type = 'AskUserQuestionResponse';
```

This is not needed for v1 — the existing `room_id` index is sufficient for small-to-medium rooms.

---

## 8. Server-side type changes

### `packages/worker/src/lib/types.ts`

Extend the `Message` type:

```typescript
export type Message = {
  id: string
  room_id: string
  sender: string
  sender_type: 'human' | 'agent'
  content: string
  color: string | null
  type: 'message' | 'log' | 'AskUserQuestion' | 'AskUserQuestionResponse'
  seq: number | null
  created_at: string
}
```

---

## 9. Files to Change

### Worker (packages/worker/)

| File | Change |
|------|--------|
| `src/routes/rooms.ts` | Accept `type` field in POST messages body; whitelist allowed types |
| `src/lib/types.ts` | Extend `Message.type` union |
| `src/app/lib/types.ts` | Extend client `Message.type` union |
| `src/app/lib/api.ts` | Add `type` parameter to `sendMessage()` |
| `src/app/components/AskQuestionCard/AskQuestionCard.tsx` | **New file** — interactive question card component |
| `src/app/components/MessageList/MessageList.tsx` | Render `AskQuestionCard` for `AskUserQuestion` type; filter out `AskUserQuestionResponse` from standalone rendering |
| `src/app/components/ChatView/ChatView.tsx` | Add `handleAnswer` callback; pass to MessageList |

### CLI (packages/cli/)

| File | Change |
|------|--------|
| `src/client.ts` | Add `type` parameter to `sendMessage()` |
| `src/index.ts` | Add `send-ask-question` command case |

### Hook (reference only — future task)

| File | Change |
|------|--------|
| `.claude/hooks/log-tool-use.sh` | Future: intercept AskUserQuestion tool, send via CLI, wait for response |

---

## 10. Implementation Order

1. **Server types** — extend `Message.type` union in both type files
2. **API route** — accept `type` in POST body, pass through to `insertMessage` and broadcast
3. **CLI client** — add `type` param to `sendMessage`
4. **CLI command** — add `send-ask-question` case
5. **Client API** — add `type` param to `sendMessage` in `api.ts`
6. **AskQuestionCard component** — build the interactive card
7. **MessageList integration** — render cards, filter responses
8. **ChatView integration** — wire up answer handler
9. **Test end-to-end** — send via CLI, answer in UI, verify agent receives response

---

## 11. Open Questions

1. **Should the answer also be sent as a regular readable message?** Currently the response is JSON-only. It might be useful to also send a human-readable "Selected: Option A" message so the chat history reads naturally. Alternative: render the response inline on the question card (proposed approach).

2. **Multi-select UX:** Should there be a "Submit" button for multi-select, or submit on each click? Recommendation: show checkboxes + Submit button for multi-select, instant submit for single-select.

3. **Free-text option:** Should the card support an optional free-text input alongside the buttons? The Claude Code `AskUserQuestion` tool supports free-text responses. This could be a v2 enhancement — for v1, stick to predefined options only.

4. **Question expiry:** Should questions auto-expire visually if the agent disconnects? Recommendation: check agent status in team-info; if the asking agent is inactive, show a muted "Agent no longer active" note on the card.
