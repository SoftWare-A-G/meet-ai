# Milestone 1: Message List Performance (FlashList v2 Migration)

## Goal

Replace `FlatList` with `FlashList v2` for the chat message list, add pagination, and memoize message components for 60fps scrolling with 500+ messages.

## Scope

- Install `@shopify/flash-list` v2
- **Refactor `rooms/[id].tsx`** (currently 503 lines) — extract `MessageBubble`, `LogGroup`, and markdown styles into separate component files before migration
- Replace `FlatList` in `rooms/[id].tsx` with `FlashList`
- Migrate from `inverted` prop to `maintainVisibleContentPosition` + reversed data array (FlashList v2 deprecates `inverted`)
- Configure `startRenderingFromBottom: true` and `autoscrollToBottomThreshold`
- Set accurate `estimatedItemSize` for message bubbles
- Memoize `MessageBubble` and `LogGroup` components with `React.memo` and stable keys (audit found: `renderItem` is inline, no memoization)
- Add pagination: load 30-50 messages initially, fetch older messages on scroll-to-top (audit found: currently loads ALL messages at once — will degrade with 500+ messages)
- Loading spinner at top when fetching older messages

## Out of Scope

- "New messages" pill (Milestone 4)
- Message appear animations (Milestone 4)
- Optimistic send / message status indicators (Milestone 3)
- Keyboard handling changes (Milestone 2)

## Dependencies

None — this is the foundational milestone.

## Key Files

| Action | File |
|--------|------|
| Modify | `packages/meet-ai-app/src/app/(app)/rooms/[id].tsx` |
| Modify | `packages/meet-ai-app/src/hooks/use-room-websocket.ts` (pagination support) |
| Modify | `packages/meet-ai-app/src/lib/api.ts` (paginated message fetch) |
| Create | `packages/meet-ai-app/src/components/message-bubble.tsx` (extract + memoize) |
| Create | `packages/meet-ai-app/src/components/log-group.tsx` (extract + memoize) |
| Create | `packages/meet-ai-app/src/constants/markdown-styles.ts` (extract markdown styles) |
| Modify | `packages/meet-ai-app/package.json` |

## Packages to Install

```bash
bun add -E @shopify/flash-list@^2.0.0
```

## Acceptance Criteria

- [x] Chat screen renders messages using FlashList v2 (no FlatList usage)
- [x] Messages render from bottom, newest at bottom
- [x] Scroll position maintained when new messages arrive (while scrolled up)
- [x] Auto-scroll to bottom when user is at/near bottom and new message arrives
- [x] Scrolling up past the initial batch triggers pagination — older messages load without layout jumps
- [x] Loading indicator shown while fetching older messages
- [x] Message bubble is wrapped in `React.memo` with stable key
- [x] No `inverted` prop used — using reversed data + `maintainVisibleContentPosition` instead

## Audit Notes (2026-02-18)

- All criteria verified in code. FlashList v2 is used with `maintainVisibleContentPosition` and `startRenderingFromBottom: true`.
- Client-side pagination implemented via `visibleCount` slicing with a "Load older messages" button and loading spinner.
- `MessageBubble` and `LogGroup` are both wrapped in `React.memo`.
- `estimatedItemSize` is not explicitly set on FlashList — FlashList v2 will auto-estimate, but setting it could improve initial render performance.
- Components were successfully extracted to separate files: `message-bubble.tsx`, `log-group.tsx`, `chat-input-bar.tsx`.

## Implementation Notes

- FlashList v2 is a ground-up rewrite for New Architecture. The `inverted` prop is deprecated — must use `maintainVisibleContentPosition` with a reversed data array instead.
- `maintainVisibleContentPosition` is enabled by default in FlashList v2 and always animates scroll — there's no instant-jump option (known open issue).
- FlashList v2 uses cell recycling, so ensure message components handle being reused with different data (no stale closures, no state that persists across recycles).
- The existing `use-room-websocket.ts` hook manages message state — extend it to support prepending older messages from pagination.
- For pagination, the backend supports `?since_seq=` for catching up. Verify if there's a `?before_seq=` or equivalent for loading older messages. If not, use offset-based pagination with the existing API.
- `estimatedItemSize` should be set based on average message bubble height (likely ~80-100px for text messages, higher for code blocks).
- Dev client required — FlashList has native modules, won't work in Expo Go.
