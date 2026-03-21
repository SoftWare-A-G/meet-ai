# CLI-to-Web Autocomplete Suggestions Research

**Date**: 2026-02-22
**Status**: Research complete, not yet implemented
**Feasibility**: HIGH (~2-3 hours)

---

## Concept

Pass one-time commands from the Claude Code CLI to the meet-ai web UI as autocomplete suggestions in the textarea. When an agent sends a suggestion via CLI, it appears as clickable chips above the chat input in the web UI.

## Current Architecture

### CLI (`packages/cli/src/`)
- Built with `citty`, subcommand-based
- Each command: `command.ts` (citty) + `schema.ts` (zod) + `usecase.ts` (logic)
- Client in `client.ts` has methods: `sendMessage()`, `sendTeamInfo()`, `sendTasks()`

### Web Chat Input (`packages/worker/src/app/components/ChatInput/ChatInput.tsx`)
- Uses `react-mentions-ts` MentionsInput with @mention suggestions
- Already has a suggestion dropdown UI built into mentions system
- State: `value` (markup), `plainText`

### WebSocket Flow
CLI -> REST API (Hono) -> ChatRoom Durable Object -> broadcasts to all WS clients

Existing non-message WS types:
- `team_info`: cached in DO memory + storage, sent to new clients on connect
- `tasks_info`: cached in DO memory + storage, sent to new clients on connect
- `plan_decision` / `question_answer`: broadcast only, not cached

## Recommended Approach

Follow the `team_info` / `tasks_info` pattern exactly.

### Data Shape

```ts
type Suggestion = {
  label: string      // Display text on the chip
  command: string    // Text to populate in textarea on click
  autoSend?: boolean // Auto-send on click (default: false)
  color?: string     // Optional chip color
}

type SuggestionsInfo = {
  suggestions: Suggestion[]
}
```

### New CLI Command

```bash
meet-ai send-suggestion "<ROOM_ID>" '<json-payload>'
```

### Implementation Files

**Worker changes:**
- `packages/worker/src/schemas/rooms.ts` — Add `suggestionSchema`
- `packages/worker/src/routes/rooms.ts` — Add `POST /:id/suggestions` route
- `packages/worker/src/durable-objects/chat-room.ts` — Add `/suggestions` handler (cache + broadcast)
- `packages/worker/src/app/lib/types.ts` — Add `Suggestion` and `SuggestionsInfo` types
- `packages/worker/src/app/hooks/useRoomWebSocket.ts` — Handle `'command_suggestion'` type
- `packages/worker/src/app/lib/chat-context.ts` — Add suggestions to context
- `packages/worker/src/app/components/ChatInput/ChatInput.tsx` — Render suggestion chips above textarea

**CLI changes:**
- `packages/cli/src/commands/send-suggestion/` — command.ts, schema.ts, usecase.ts
- `packages/cli/src/client.ts` — Add `sendSuggestion()` method
- `packages/cli/src/types.ts` — Add to `MeetAiClient` interface
- `packages/cli/src/index.ts` — Register `send-suggestion` subcommand

### Key Design Decisions

- **Caching**: Cache in DO storage so suggestions survive WS reconnects
- **Replace semantics**: New `send-suggestion` call replaces all previous suggestions
- **Click behavior**: Clicking chip populates textarea text, user reviews before sending. Optional `autoSend` for trusted commands
- **Clear**: Send empty `suggestions: []` to remove all chips
