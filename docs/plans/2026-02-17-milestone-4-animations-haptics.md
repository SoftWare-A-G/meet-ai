# Milestone 4: Animations & Haptics

## Goal

Add polish animations to the chat experience: message appear effects, new-message pill indicator, log group expand/collapse animation, and haptic feedback on key interactions.

## Scope

- **Message appear animation**: `FadeInDown` via `react-native-reanimated` layout animations on new messages
- **New messages pill**: When user is scrolled up and new messages arrive, show a floating pill at the bottom ("N new messages — tap to scroll down"). Slide-up animation. Tapping scrolls to bottom.
- **Log group expand/collapse**: Smooth height animation when expanding/collapsing agent log groups (using Reanimated or `LayoutAnimation`)
- **Haptic feedback**: Light impact on message send (`Haptics.impactAsync`), selection feedback on long-press (`Haptics.selectionAsync`)
- Install `expo-haptics`

## Out of Scope

- Typing indicator animation (Phase 2 — requires backend support)
- Message reactions animation (Phase 2)
- Swipe-to-reply gesture (Phase 2)
- Long-press context menu (Phase 2)

## Dependencies

- **Milestone 1** (FlashList) — message animations need FlashList in place
- **Milestone 2** (input bar) — send button animation is in M2; haptics on send is in this milestone
- Can start after M1 and M2 are substantially complete.

## Key Files

| Action | File |
|--------|------|
| Modify | `packages/meet-ai-app/src/components/message-bubble.tsx` (enter animation) |
| Create | `packages/meet-ai-app/src/components/new-messages-pill.tsx` (floating indicator) |
| Modify | `packages/meet-ai-app/src/app/(app)/rooms/[id].tsx` (pill logic, scroll tracking, haptics on send) |
| Modify | Log group component in `rooms/[id].tsx` (expand/collapse animation) |
| Modify | `packages/meet-ai-app/package.json` |

## Packages to Install

```bash
bun add -E expo-haptics@~55.0.0
```

Note: `react-native-reanimated` is already installed (~4.2.1).

## Acceptance Criteria

- [ ] New messages entering the list have a subtle fade-in-from-bottom animation
- [ ] Animation only plays for truly new messages (not on initial load or pagination)
- [x] When scrolled up 100+ px from bottom, a "new messages" pill appears when new messages arrive
- [x] Pill shows count of unread messages since scrolling up
- [x] Tapping the pill scrolls to the bottom and dismisses it
- [x] Pill has a slide-up entrance animation and fade-out on dismiss
- [x] Expanding/collapsing log groups has a smooth height transition (no layout jump)
- [x] Haptic feedback fires on message send (light impact)
- [x] Haptic feedback fires on long-press of a message (selection feedback)
- [x] Animations do not cause dropped frames — maintain 60fps

## Audit Notes (2026-02-18)

- **FadeInDown message animation is NOT implemented.** No `FadeInDown` or equivalent enter animation on message bubbles. This was intentionally removed per user preference to avoid jank with FlashList cell recycling.
- New messages pill: fully implemented in `new-messages-pill.tsx` with `SlideInDown` entrance and `FadeOut` exit animations via Reanimated. Threshold is 150px (`AUTO_SCROLL_THRESHOLD`).
- Log group expand/collapse uses `LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)` for smooth transitions.
- Haptics: `Haptics.impactAsync(Light)` on send in `[id].tsx`, `Haptics.selectionAsync()` on long-press in `message-bubble.tsx`.
- `expo-haptics` is installed and working.

## Implementation Notes

- For message enter animations, wrap the message bubble in `Animated.View` with `entering={FadeInDown.duration(200)}`. Only apply to messages received after the initial load (use a flag or sequence comparison).
- FlashList v2 with cell recycling may conflict with Reanimated layout animations — test carefully. If enter animations cause jank with FlashList, consider applying them only to the most recent message.
- The "new messages" pill should track scroll offset via `onScroll` and compare against a threshold (e.g., 100px from bottom). Use `Animated.Value` or Reanimated shared value for scroll position.
- For log group animations, `LayoutAnimation.configureNext()` before toggling the expanded state is the simplest approach. If it conflicts with FlashList, use Reanimated's height animation instead.
- `expo-haptics` works in Expo Go but is most reliable via dev client. No native build step required.
- Haptics on iOS are richer (Taptic Engine) vs Android (simple vibration). The API abstracts this — no platform branching needed.
