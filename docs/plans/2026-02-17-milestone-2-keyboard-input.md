# Milestone 2: Keyboard Handling & Input Bar

## Goal

Migrate from built-in `KeyboardAvoidingView` to `react-native-keyboard-controller` for smooth, native keyboard transitions, and improve the text input with auto-grow behavior and send button animation.

## Scope

- Install `react-native-keyboard-controller` v1.20+
- Wrap the app root with `KeyboardProvider`
- Replace `KeyboardAvoidingView` in chat screen with `KeyboardStickyView` from keyboard-controller
- Configure interactive keyboard dismiss on iOS (`keyboardDismissMode="interactive"`)
- Auto-growing `TextInput` with max height cap (~4 lines / 120px) using `onContentSizeChange` (audit found: current code has `maxHeight: 120` in style but no dynamic height tracking)
- Send button scale animation (appear when text is entered, disappear when empty) using `react-native-reanimated`
- Proper safe area handling for input bar (bottom inset via `useSafeAreaInsets`)

## Out of Scope

- @mentions / rich text (react-native-enriched) — Phase 2
- Attachment button — Phase 2
- Voice message button — Phase 2
- Typing indicators — Phase 2

## Dependencies

None — can run in parallel with Milestone 1. Both modify `rooms/[id].tsx` but in different sections (list vs. input area).

## Key Files

| Action | File |
|--------|------|
| Modify | `packages/meet-ai-app/src/app/(app)/rooms/[id].tsx` (replace KeyboardAvoidingView, update input bar) |
| Modify | `packages/meet-ai-app/src/app/_layout.tsx` (add KeyboardProvider at root) |
| Create | `packages/meet-ai-app/src/components/chat-input-bar.tsx` (extract input bar component) |
| Modify | `packages/meet-ai-app/package.json` |

## Packages to Install

```bash
bun add -E react-native-keyboard-controller@^1.20.0
```

Note: `react-native-reanimated` (already installed ~4.2.1) is a peer dependency of keyboard-controller.

## Acceptance Criteria

- [x] Input bar stays pinned above keyboard on both iOS and Android (no gap, no overlap)
- [x] iOS: interactive keyboard dismiss works (drag down on chat list to dismiss keyboard)
- [x] Android: keyboard dismiss on back button or tap outside input works
- [x] Input grows from 1 line to max 4 lines as user types
- [x] Input does not grow beyond max height — becomes scrollable instead
- [ ] Send button animates in (scale up) when text is entered
- [ ] Send button animates out (scale down) when input is cleared
- [x] No `KeyboardAvoidingView` usage remains in the chat screen
- [x] `KeyboardProvider` wraps the app at root level

## Audit Notes (2026-02-18)

- `KeyboardProvider` wraps the app at root in `_layout.tsx`.
- Chat screen uses `useReanimatedKeyboardAnimation` and `useKeyboardHandler` from `react-native-keyboard-controller` — no `KeyboardAvoidingView` in the chat screen (only remains in the login screen, which is out of scope).
- Input bar uses `onContentSizeChange` with height clamped between 40-120px. Works correctly.
- `keyboardDismissMode="interactive"` is set on the FlashList for iOS interactive dismiss.
- **Send button scale animation is NOT implemented.** The send button uses simple opacity changes via `Pressable` style, not Reanimated scale animations. This was not prioritized.

## Implementation Notes

- `KeyboardStickyView` is the key component — it moves content with the keyboard rather than resizing, which is smoother for chat UIs.
- The `offset` prop on `KeyboardStickyView` should account for the safe area bottom inset: `offset={{ closed: 0, opened: bottomInset }}`.
- For auto-grow, use `TextInput`'s `onContentSizeChange` event to track content height, then clamp with `Math.min(contentHeight, 120)`.
- The send button animation should use `useAnimatedStyle` + `withSpring` from Reanimated for a natural feel.
- `react-native-keyboard-controller` requires a dev client (native module). Not compatible with Expo Go.
- On Android, `softwareKeyboardLayoutMode: "resize"` is already configured in app.json — verify it still works correctly with keyboard-controller.
- Interactive keyboard dismiss only works on iOS — this is a platform limitation.
