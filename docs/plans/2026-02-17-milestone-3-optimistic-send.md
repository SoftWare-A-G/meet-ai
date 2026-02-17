# Milestone 3: Optimistic Send & Connection Status

## Goal

Implement optimistic message sending with status indicators (sending/sent/failed), a retry mechanism for failed messages, an offline message queue, and a richer connection status indicator.

## Scope

- **Optimistic send**: When user sends a message, immediately append it to the local message list with `status: "sending"` and a local temp ID
- **Server ACK**: On WebSocket confirmation (or HTTP 200 from POST), update status to `"sent"` and replace temp ID with server ID
- **Failure handling**: On error/timeout, update status to `"failed"` and show a retry button on the message
- **Retry**: Tapping retry re-sends the message
- **Message status indicators**: Visual indicators on each user-sent message (spinner for sending, checkmark for sent, red icon for failed)
- **Offline message queue**: When WebSocket is disconnected, queue messages in memory. Flush queue in order on reconnect.
- **Connection quality indicator**: Replace the binary "Reconnecting..." banner with a richer status bar showing: connected (green dot), reconnecting (yellow, with animation), offline (red, with "Messages will be sent when reconnected" text)

## Out of Scope

- Persistent offline queue across app restarts (Phase 2 — requires expo-sqlite)
- Typing indicators (Phase 2 — requires backend support)
- Read receipts (Phase 2)

## Dependencies

- **Milestone 1** should be done first — the FlashList migration changes the message list rendering, and this milestone adds status fields to messages that need to render correctly in FlashList.

## Key Files

| Action | File |
|--------|------|
| Modify | `packages/meet-ai-app/src/hooks/use-room-websocket.ts` (optimistic append, ACK handling, queue) |
| Modify | `packages/meet-ai-app/src/lib/types.ts` (add message status type, temp ID field) |
| Modify | `packages/meet-ai-app/src/app/(app)/rooms/[id].tsx` (connection status bar, retry UI) |
| Modify | `packages/meet-ai-app/src/components/message-bubble.tsx` (status indicators) |
| Create | `packages/meet-ai-app/src/components/connection-status.tsx` (connection quality bar) |
| Modify | `packages/meet-ai-app/src/lib/api.ts` (send message with temp ID tracking) |

## Packages to Install

None — uses existing dependencies.

## Acceptance Criteria

- [x] Sent message appears instantly in the list with a "sending" indicator (spinner or clock icon)
- [x] On server ACK, indicator changes to "sent" (checkmark)
- [x] On failure, indicator changes to "failed" (red icon) with a retry button
- [x] Tapping retry re-sends the message and resets status to "sending"
- [x] When disconnected, messages typed and sent are queued locally
- [x] On reconnect, queued messages are sent in order and appear with correct status transitions
- [x] Connection status bar shows current state: connected / reconnecting / offline
- [x] Connection status bar is visually distinct from message content (e.g., colored bar at top of chat)
- [x] Reconnecting state shows an animation (pulsing dot or spinner)

## Audit Notes (2026-02-18)

- All criteria verified. Full optimistic send pipeline implemented in `use-room-websocket.ts`.
- `MessageStatus` type added to `types.ts` with `'sending' | 'sent' | 'failed'`.
- `MessageStatusIndicator` component in `message-bubble.tsx` shows spinner (sending), checkmark (sent), or red X with retry button (failed).
- Offline queue uses in-memory `offlineQueueRef` array, flushed in order on reconnect.
- Connection status bar (`connection-status.tsx`) shows yellow pulsing bar for reconnecting, red bar for offline, hidden when connected.
- Status transitions are debounced (500ms) to avoid flicker on brief disconnects.
- Send timeout of 10 seconds before marking as failed.

## Implementation Notes

- Use a UUID or incrementing local counter for temp message IDs. Prefix with `local_` to distinguish from server IDs.
- The optimistic message should be inserted into the same messages array used by FlashList, with extra fields: `status: "sending" | "sent" | "failed"`, `localId: string`.
- On server ACK, match by `localId` and update the message in place (replace temp ID with server's `id` and `seq`).
- For the offline queue, a simple in-memory array is sufficient for this milestone. Persistent queue (surviving app kills) is Phase 2.
- The connection status should be derived from the WebSocket `readyState` + reconnection state already tracked in `use-room-websocket.ts`.
- Consider debouncing status transitions to avoid flicker (e.g., don't show "reconnecting" if the reconnect succeeds within 500ms).
