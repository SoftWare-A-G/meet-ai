# Milestone 5: Accessibility & Platform Polish

## Goal

Add comprehensive accessibility support across the chat experience and fine-tune platform-specific behaviors for iOS and Android.

## Scope

### Accessibility
- **Message bubbles**: `accessibilityLabel` with sender name, message text, and timestamp
- **Send button**: `accessibilityRole="button"`, `accessibilityLabel="Send message"`
- **Input field**: `accessibilityLabel="Type a message"`, `accessibilityHint="Double tap to start typing"`
- **Agent status**: Announce active/inactive state on agents panel
- **New message announcements**: `AccessibilityInfo.announceForAccessibility` when new messages arrive while scrolled up
- **Minimum touch targets**: Audit and enforce 44x44pt on all interactive elements (send button, retry button, pill, log group toggle, etc.)
- **Connection status**: accessible labels on connected/reconnecting/offline states

### Platform Polish
- **iOS scroll bounce**: Ensure enabled (default)
- **Android overscroll glow**: Ensure proper behavior (no bounce)
- **iOS touch feedback**: Opacity reduction on press for buttons
- **Android touch feedback**: Ripple effect on pressable elements
- **Safe area handling audit**: Verify top/bottom insets on both platforms, especially with keyboard-controller
- **Status bar**: Correct light/dark appearance per screen and theme

## Out of Scope

- Biometric lock (Phase 2)
- Tablet layout (Phase 2)
- VoiceOver/TalkBack full audit (defer to QA)

## Dependencies

- **Milestones 1-4** — this is a polish pass over all completed features. Should be the final milestone.

## Key Files

| Action | File |
|--------|------|
| Modify | `packages/meet-ai-app/src/components/message-bubble.tsx` (a11y labels) |
| Modify | `packages/meet-ai-app/src/components/chat-input-bar.tsx` (a11y labels, touch targets) |
| Modify | `packages/meet-ai-app/src/components/connection-status.tsx` (a11y labels) |
| Modify | `packages/meet-ai-app/src/components/new-messages-pill.tsx` (a11y labels, touch target) |
| Modify | `packages/meet-ai-app/src/app/(app)/rooms/[id].tsx` (a11y announcements, platform-specific props) |
| Modify | `packages/meet-ai-app/src/app/(app)/agents.tsx` (a11y for agent status) |
| Modify | `packages/meet-ai-app/src/app/(app)/index.tsx` (a11y for room list items) |

## Packages to Install

None — uses built-in React Native accessibility APIs.

## Acceptance Criteria

- [x] Every message bubble has an `accessibilityLabel` with format: "{sender} said: {text}, {timeAgo}"
- [x] Send button has `accessibilityRole="button"` and label "Send message"
- [x] Text input has label "Type a message" and hint "Double tap to start typing"
- [x] Agent status (active/inactive) is announced to screen readers
- [x] New messages arriving while scrolled up trigger `announceForAccessibility`
- [ ] All interactive elements have minimum 44x44pt touch targets
- [x] Connection status bar announces state changes to screen readers
- [x] iOS: scroll bounce enabled on message list
- [x] Android: proper overscroll glow (no bounce)
- [x] Platform-appropriate touch feedback on all pressable elements
- [ ] Status bar appearance matches current theme (light/dark)

## Audit Notes (2026-02-18)

- Message bubbles have `accessibilityLabel` with "{sender} said: {truncated text}, {timeAgo}" format. Truncated at 200 chars.
- Send button: `accessibilityRole="button"`, `accessibilityLabel="Send message"`, 44x44pt size. Correct.
- Text input: `accessibilityLabel="Type a message"`, `accessibilityHint="Double tap to start typing"`. Correct.
- Agent status: `agents.tsx` has `accessibilityLabel` with name, role, and active/inactive status. Correct.
- `announceForAccessibility` fires when new messages arrive while scrolled up. Correct.
- Connection status: uses `accessibilityRole="alert"` and `accessibilityLiveRegion="polite"` with descriptive labels. Correct.
- iOS bounce: `bounces={Platform.OS === 'ios'}` on FlashList. Correct.
- Android overscroll: `overScrollMode="always"` on Android. Correct.
- Platform touch feedback: iOS uses opacity press style, Android uses `android_ripple`. Applied on room list items, agents button, send button, message long-press, load older button. Correct.
- **Touch targets**: Send button is 44x44 (good), new messages pill has `minHeight: 44` (good), agents button is 44x44 (good). However, retry button on failed messages and log group toggle header do not enforce 44pt minimum height. Partially met.
- **Status bar theme**: No explicit `StatusBar` component configuration found. The app uses `ThemeProvider` from `@react-navigation/native` which handles navigation bar styling, but there's no explicit `StatusBar` barStyle/appearance management. Not verified as fully implemented.

## Implementation Notes

- For `accessibilityLabel` on messages, compute a readable string: `"{sender} said: {truncatedText}, {relativeTime}"`. Truncate very long messages to ~200 chars for screen readers.
- Use `AccessibilityInfo.announceForAccessibility()` sparingly — only when the user is scrolled up and new messages arrive. Don't announce every message when the user is at the bottom (they can see them).
- For touch targets, use `hitSlop` to expand the touchable area without changing visual size where needed.
- Platform-specific touch feedback: use `Pressable` with `android_ripple` for Android and opacity-based `style` function for iOS.
- This milestone is a good candidate for manual testing on real devices with VoiceOver (iOS) and TalkBack (Android) enabled.
