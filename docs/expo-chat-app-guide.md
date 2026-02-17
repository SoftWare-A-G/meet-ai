# Building Chat Apps with React Native + Expo: Comprehensive Guide

> Compiled February 2026. Updated with Expo SDK 54 (stable) and SDK 55 (beta) changes. Covers libraries, patterns, and best practices for building production-quality chat experiences on iOS and Android.

---

## Table of Contents

0. [SDK 54/55 Update Summary](#0-sdk-5455-update-summary)
1. [Chat UI Libraries](#1-chat-ui-libraries)
2. [Message List Performance](#2-message-list-performance)
3. [Keyboard Handling](#3-keyboard-handling)
4. [Input Bar](#4-input-bar)
5. [Media in Chat](#5-media-in-chat)
6. [Real-Time Messaging](#6-real-time-messaging)
7. [Push Notifications](#7-push-notifications)
8. [Platform-Specific Tips](#8-platform-specific-tips)
9. [Animations](#9-animations)
10. [Accessibility](#10-accessibility)
11. [New Expo SDK Features](#11-new-expo-sdk-features-sdk-52-through-55)

---

## 0. SDK 54/55 Update Summary

> This section was added in February 2026 to update findings that previously referenced SDK 52/53.

### Expo SDK 54 (Stable, September 2025)

- **React Native 0.81** + **React 19.1**
- **Last SDK with Legacy Architecture** — SDK 54 is the final release supporting the old architecture. ~75% of SDK 53 projects already use New Architecture.
- **Precompiled XCFrameworks for iOS** — clean build times dropped from ~120s to ~10s on M4 Max. Significant DX improvement.
- **Android 16 / API 36 mandatory** — edge-to-edge is now always enabled and cannot be disabled. `react-native-edge-to-edge` package removed from `expo` (functionality built into RN 0.81).
- **expo-av officially deprecated** — will be fully removed in SDK 55. Migrate to `expo-audio` + `expo-video` now.
- **expo-file-system API swap** — the new object-oriented API (`expo-file-system/next`) is now the default export. Legacy API available via `expo-file-system/legacy`.
- **expo-notifications** — deprecated function exports removed. Update call sites.
- **localStorage via expo-sqlite** — drop-in `localStorage` web API implementation.
- **iOS 26 Liquid Glass** — new `expo-glass-effect` library (`<GlassView>`, `<GlassContainer>`). Expo UI (beta) for SwiftUI primitives.
- **Reanimated v4** — introduces `react-native-worklets`, New Architecture only. Use Reanimated v3 if still on Legacy Architecture. NativeWind does not yet support v4.
- **JSC removed** — JavaScriptCore no longer bundled. Hermes is the only built-in engine.
- **Node minimum**: 20.19.4. **Xcode**: 16.1 minimum, 26 recommended.

### Expo SDK 55 (Beta, January 2026)

- **React Native 0.83.1** + **React 19.2**
- **New Architecture mandatory** — `newArchEnabled` config removed from app.json. No opt-out.
- **Hermes v1 opt-in** — available via `useHermesV1` in `expo-build-properties`. Planned default in SDK 56.
- **Hermes bytecode diffing** — OTA update downloads reduced by ~75%. Opt-in via `enableBsdiffPatchSupport` (default in SDK 56).
- **expo-audio** — now supports **lock-screen controls** and **background recording**. Approaching stability.
- **expo-image** — HDR image support on iOS; SF Symbols rendering.
- **expo-notifications** — updated Android Firebase dependency; improved parameter validation.
- **expo-blur** — Android now stable using efficient RenderNode API (Android 12+).
- **expo-sharing** — experimental support for receiving shared data into apps.
- **expo-av removed from Expo Go** — replaced by `expo-video` and `expo-audio`.
- **expo-video** — `generateThumbnailsAsync` added; `expo-video-thumbnails` deprecated.
- **React 19.2 `<Activity>` component** — hide/deactivate UI without losing state. Useful for preserving chat screen state during navigation.
- **React Native 0.83** — zero user-facing breaking changes. New DevTools with deep performance tracing. The `<Activity>` component works in RN.
- **FlashList v2** — fully compatible (New Architecture only, which SDK 55 mandates). FlashList v1 is not compatible with SDK 55.
- **Reanimated v4** — fully compatible with SDK 55's mandatory New Architecture.
- **react-native-keyboard-controller** — actively maintained (v1.20+), compatible with SDK 55.
- **Minimum iOS**: 15.1 (planned bump to 16.4 in SDK 56).

### Impact on Our 15 Best Practices

| Practice | SDK 54/55 Impact |
|----------|-----------------|
| FlashList v2 for message list | FlashList v2 required in SDK 55 (v1 won't work with mandatory New Arch) |
| react-native-keyboard-controller | Still recommended. v1.20+ works with SDK 55. |
| react-native-enriched for rich input | Fully compatible — was already New Arch only |
| expo-av for audio | **Must migrate** to expo-audio + expo-video. expo-av removed in SDK 55. |
| Edge-to-edge safe areas | Now mandatory on Android via RN 0.81+. react-native-edge-to-edge package no longer needed. |
| Reanimated animations | Use Reanimated v4 on SDK 55 (New Arch only). NativeWind users must stay on v3. |
| expo-notifications | Remove deprecated function calls. Update Firebase deps on Android. |
| expo-image for display | Gains HDR + SF Symbols in SDK 55. No breaking changes. |
| Local DB with expo-sqlite | Now includes localStorage API. Stable. |
| New Architecture | No longer optional in SDK 55. All deps must support Fabric. |

---

## 1. Chat UI Libraries

### react-native-gifted-chat

- **GitHub**: ~14.3k stars | Actively maintained (v3.3.2)
- **Expo**: Works with Expo, but **not fully compatible with Expo Go** (keyboard-controller and FlashList deps need native modules). Use a dev client.
- **Pros**: Most popular RN chat UI. Rich feature set — message bubbles, avatars, composer, quick replies, typing indicator, day separators. Highly customizable via render props.
- **Cons**: Slow iteration on issues. Known problems with FlashList integration in recent Expo SDKs. Keyboard controller crashes in Expo managed workflow. Relies on community for maintenance (single maintainer seeking sponsors).
- **Verdict**: Good starting point for MVPs. For production apps with complex requirements, consider building a custom chat UI on top of FlashList/Legend List.

### Stream Chat React Native SDK

- **GitHub**: ~1.1k stars | Professionally maintained by GetStream
- **Expo**: Officially supports Expo with dev client. Example Expo app in repo.
- **Pros**: Full-featured — threads, reactions, file attachments, typing indicators, read receipts, moderation, offline support (opt-in). Backed by a company with dedicated support. Excellent docs.
- **Cons**: Requires Stream backend (SaaS). Free tier limited to <5 team members and <$10k monthly revenue. Vendor lock-in.
- **Verdict**: Best option if you want a complete managed chat solution and can accept the pricing model.

### Other SDKs (Backend + UI)

| Library | Notes |
|---------|-------|
| **Sendbird** | UIKit with togglable features (read receipts, typing indicators). Native SDKs for RN. Paid. |
| **CometChat** | Voice/video calls built-in. No-code widgets + native code. Paid. |
| **TalkJS** | Customizable UIKit. Good for embedding chat in existing apps. Paid. |
| **MirrorFly** | Self-hosted option available. Good for healthcare/fintech compliance. |
| **PubNub** | Real-time infrastructure. Lower-level than Stream — more DIY. |

### Custom Chat UI (Recommended for Full Control)

Build your own using:
- **FlashList v2** or **Legend List** for the message list
- **react-native-keyboard-controller** for keyboard handling
- **react-native-enriched** for rich text input with mentions
- Custom message bubble components with `react-native-reanimated` animations

This approach gives maximum control and avoids dependency on libraries that may lag behind RN/Expo updates.

---

## 2. Message List Performance

### The Big Three: FlatList vs FlashList v2 vs Legend List

#### FlatList (Built-in)

- **Approach**: Virtualization — renders only visible items + buffer, unmounts off-screen items
- **Pros**: Zero dependencies. `inverted` prop works well for chat. Stable.
- **Cons**: Can struggle with complex layouts. Higher JS thread CPU usage. Memory pressure with large histories.
- **When to use**: Simple chats with <1000 messages and basic bubble layouts.

#### FlashList v2 (Shopify)

- **GitHub**: ~6k+ stars | Ground-up rewrite for New Architecture (2025)
- **Approach**: Cell recycling — reuses component instances instead of destroy/recreate
- **Key chat features**:
  - `maintainVisibleContentPosition` (enabled by default) — holds scroll position when new messages arrive
  - `startRenderingFromBottom: true` — renders from bottom, ideal for chat
  - `autoscrollToBottomThreshold` — auto-scroll when near bottom
- **Performance**: JS thread CPU from >90% down to <10% vs FlatList. Eliminates OOM crashes.
- **Expo**: Works with Expo. Requires dev client (native module).
- **Gotchas**:
  - `inverted` prop is **deprecated in v2** — use `maintainVisibleContentPosition` + reversed data array instead
  - Pagination UX regression reported: scroll direction inconsistency when loading older messages
  - `maintainVisibleContentPosition` always animates scroll — no way to "jump" instantly (open issue)
  - Inverted FlashList doesn't respect keyboard insets (open issue)
- **Verdict**: Best performance for most chat apps. Be aware of the v2 migration gotchas.

#### Legend List (@legendapp/list)

- **GitHub**: Growing community | Pure TypeScript, no native deps
- **Approach**: Custom virtualization optimized for dynamic heights
- **Key chat features**:
  - `alignItemsAtEnd` — aligns content to bottom (chat pattern)
  - `maintainScrollAtEnd` — keeps scroll at bottom as messages arrive
  - Infinite scrolling in both directions without jumps or flashes
- **Pros**: No native linking. Dynamic heights with zero performance hit. Drop-in FlatList/FlashList API replacement.
- **Cons**: Newer, smaller community. Less battle-tested at scale.
- **When to use**: When you need dynamic message heights (mixed media, expandable messages) and want to avoid native dependencies.

### Performance Tips

1. **Use `estimatedItemSize`** (FlashList) or `estimatedHeight` (Legend List) — accurate estimates prevent layout jumps
2. **Memoize message components** with `React.memo` and stable keys
3. **Avoid inline styles** in list items — use `StyleSheet.create`
4. **Paginate** — load 20-50 messages at a time, fetch more on scroll-to-top
5. **Use `windowSize`** prop to control render-ahead buffer
6. **Offload heavy computations** (date formatting, link detection) outside render

---

## 3. Keyboard Handling

### react-native-keyboard-controller (Recommended)

- **GitHub**: 1,700+ stars | Used by Bluesky, Expensify, V0 (Vercel)
- **Expo**: Not in Expo Go — requires dev client. Listed in Expo docs.
- **Requires**: react-native-reanimated

#### Key Components for Chat

| Component | Purpose |
|-----------|---------|
| **KeyboardStickyView** | Keeps input bar stuck above keyboard. Unlike KeyboardAvoidingView, it moves content with keyboard rather than resizing. Perfect for chat input bars. |
| **KeyboardAvoidingView** (reworked) | Drop-in replacement for RN's built-in version. Consistent cross-platform behavior. |
| **KeyboardAwareScrollView** | Auto-scrolls to keep focused input visible. Good for settings/profile screens in chat apps. |
| **KeyboardToolbar** | Previous/next/done buttons. Useful for multi-input forms. |

#### Why Not Built-in KeyboardAvoidingView?

- Inconsistent between iOS and Android (`behavior` prop: "padding" for iOS, "height" for Android)
- No animation synchronization with native keyboard
- Doesn't handle interactive keyboard dismiss gesture
- No support for keyboard accessory views

#### Chat-Specific Pattern

```tsx
import { KeyboardStickyView } from "react-native-keyboard-controller";

// The message list fills available space
// KeyboardStickyView pins the input bar above the keyboard
<View style={{ flex: 1 }}>
  <FlashList
    data={messages}
    renderItem={renderMessage}
    maintainVisibleContentPosition={{
      startRenderingFromBottom: true,
      autoscrollToBottomThreshold: 100,
    }}
  />
  <KeyboardStickyView offset={{ closed: 0, opened: bottomInset }}>
    <ChatInputBar />
  </KeyboardStickyView>
</View>
```

---

## 4. Input Bar

### Auto-Growing Text Input

React Native's `<TextInput multiline>` supports auto-growth natively:

```tsx
const [height, setHeight] = useState(40);

<TextInput
  multiline
  style={{ height: Math.min(height, 120) }} // Cap at ~4 lines
  onContentSizeChange={(e) =>
    setHeight(e.nativeEvent.contentSize.height)
  }
/>
```

Key: Set a `maxHeight` to prevent the input from taking over the screen.

### react-native-enriched (Software Mansion) — Rich Text + Mentions

- **GitHub**: New (2025) | By Software Mansion (makers of Reanimated, Gesture Handler)
- **Architecture**: New Architecture (Fabric) only. RN 0.79-0.84.
- **Expo**: Requires dev client (native code). Not Expo Go compatible.
- **Features**:
  - Bold, italic, underline, strikethrough via imperative API (`.toggleBold()`)
  - **Mentions** — `mentionIndicators` prop (default: `@`). Custom mention rendering.
  - **Images** — inline via `setImage()` ref method
  - **Auto-link detection** — URLs auto-detected, customizable regex
  - HTML output — clean, optimal HTML
  - CSS styling support
- **Pros**: Fully native (no WebView). Performant. From a trusted RN ecosystem company.
- **Cons**: New Architecture only. New library, API may evolve.
- **Verdict**: The best option for rich text input in chat. If you only need plain text + mentions, a simpler custom solution may suffice.

### Alternatives for Mentions

- **react-native-mentions** — simpler mention-only solution
- **Custom implementation** — detect `@` in TextInput, show user list overlay, replace text span

### Attachments Pattern

Typical chat input bar includes:
1. Attachment button (left of input) — opens action sheet with Camera, Photo Library, File, Location
2. Auto-growing TextInput (center)
3. Send button (right) — appears when input has text
4. Voice record button (right) — appears when input is empty (hold to record)

---

## 5. Media in Chat

### Image & Video

| Library | Purpose | Expo Go? |
|---------|---------|----------|
| **expo-image-picker** | Pick from gallery or take photo/video | Yes |
| **expo-camera** | Custom camera UI | No (dev client) |
| **expo-image** | Fast image rendering with caching (replaces RN Image) | Yes |
| **expo-video** | Video playback in messages | Yes (SDK 52+) |
| **expo-audio** | Audio playback and recording (replaces expo-av in SDK 54+) | No (dev client) |
| ~~**expo-av**~~ | ~~Audio/video playback, recording~~ **Deprecated in SDK 54, removed in SDK 55** | ~~Yes~~ |

### Audio Messages

Pattern for voice messages:
1. **Recording**: `expo-audio` recording API (SDK 54+). Show waveform during recording. SDK 55 adds background recording support.
2. **Playback**: `expo-audio` playback API. Show waveform + progress + duration. SDK 55 adds lock-screen controls.
3. **Storage**: Upload to R2/S3, store URL in message payload.

> **Migration note**: `expo-av` is deprecated in SDK 54 and removed in SDK 55. Migrate to `expo-audio` for recording/playback and `expo-video` for video. See [Expo audio docs](https://docs.expo.dev/versions/latest/sdk/audio/).

### File Sharing

| Library | Purpose |
|---------|---------|
| **@react-native-documents/picker** | Pick documents (replaces react-native-document-picker for RN >= 0.78) |
| **expo-file-system** | Read/write/download files |
| **expo-sharing** | Share files via OS share sheet |
| **react-native-blob-util** | File operations, cache management during audio recording |

### Image Compression

Before uploading, compress images to reduce bandwidth:
- **expo-image-manipulator** — resize and compress
- Target ~1MB max for chat images, preserve aspect ratio

---

## 6. Real-Time Messaging

### WebSocket Patterns

#### Singleton Connection Pattern

```tsx
class ChatSocket {
  private static instance: WebSocket | null = null;

  static connect(url: string, token: string) {
    if (this.instance?.readyState === WebSocket.OPEN) return;
    this.instance = new WebSocket(url);
    // ... setup handlers
  }
}
```

Key principles:
1. **Singleton** — one WebSocket connection per app, shared across screens
2. **Reconnection with exponential backoff** — 1s, 2s, 4s, 8s... up to 30s max
3. **Heartbeat/ping** — keep connection alive, detect stale connections
4. **Lifecycle management** — connect on app foreground, disconnect on background (with grace period)

#### Optimistic Updates

1. User sends message → immediately add to local state with `status: "sending"`
2. Send via WebSocket
3. On ACK from server → update status to `"sent"`
4. On failure → update status to `"failed"`, show retry button
5. On read receipt → update status to `"read"`

#### Offline Support

- **Queue messages** locally when offline (AsyncStorage or SQLite)
- On reconnect, flush queue in order
- Persist queue across app restarts and OS kills
- Show "offline" banner in UI
- Stream Chat SDK has built-in offline support (opt-in) with automatic retry

### State Management for Chat

- **Zustand** or **Legend State** — lightweight, performant stores
- Keep messages in a map keyed by conversation ID
- Use `immer` or immutable update patterns for message status updates
- Consider **WatermelonDB** or **SQLite** (via `expo-sqlite`) for local message persistence

---

## 7. Push Notifications

### Expo Push Notifications Setup

```
App → Expo Push Service → FCM (Android) / APNs (iOS) → Device
```

1. **Install**: `expo-notifications`
2. **Get push token**: `Notifications.getExpoPushTokenAsync()`
3. **Send from server**: POST to `https://exp.host/--/api/v2/push/send`
4. **Handle received**: `Notifications.addNotificationReceivedListener`
5. **Handle tap**: `Notifications.addNotificationResponseReceivedListener`

### Requirements

- **iOS**: Paid Apple Developer Account for APNs credentials
- **Android**: Firebase project + FCM V1 credentials
- **Both**: Store both Expo push tokens AND native device tokens for flexibility

### Notification Grouping for Chat

#### iOS
- Use `threadId` / `threadIdentifier` in notification payload to group by conversation
- Each conversation gets its own notification stack

#### Android
- Use `channelId` for notification channels (sound/vibration settings)
- Use `groupId` in payload to group notifications by conversation
- **Gotcha**: Create channels BEFORE sending notifications — Android drops notifications for non-existent channels
- **Gotcha**: After creation, you can only modify a channel's name and description

### Direct FCM/APNs (Advanced)

For more control (notification priority, silent pushes, background fetch):
- Use `expo-notifications` on client side (same API)
- Send directly to FCM/APNs from your server instead of through Expo Push Service
- Gives access to all platform-specific features

### Best Practices

- Show notification only if the user is NOT in the relevant conversation
- Update badge count on message receive
- Use `categoryIdentifier` for inline reply actions (iOS)
- Collapse duplicate notifications with `collapseId`

---

## 8. Platform-Specific Tips

### Safe Areas

- **react-native-safe-area-context** — essential for chat apps
  - Use `useSafeAreaInsets()` hook for fine-grained control
  - Apply bottom inset to input bar, top inset to header
- **Edge-to-edge on Android** — SDK 54+ (RN 0.81, Android 16) makes edge-to-edge mandatory and non-disableable. The `react-native-edge-to-edge` package is no longer needed — the functionality is built into React Native itself.

### iOS vs Android UX

| Aspect | iOS | Android |
|--------|-----|---------|
| Back navigation | Edge swipe gesture | Hardware/software back button |
| Scroll bounce | Enabled by default | Disabled by default (overscroll glow) |
| Haptic feedback | Taptic Engine (rich haptics) | Vibration (simpler) |
| Keyboard dismiss | Scroll down on content | Back button |
| Status bar | Light/dark per screen | System-controlled |
| Touch feedback | Opacity reduction | Ripple effect |
| Font | SF Pro | Roboto |

### Keyboard Dismiss

- **iOS**: `keyboardDismissMode="interactive"` on ScrollView/FlatList — drag down to dismiss
- **Android**: Tap outside input or back button. Interactive dismiss not natively supported.

### Haptics

- **expo-haptics** — works in Expo Go
- Use `Haptics.impactAsync(ImpactFeedbackStyle.Light)` on message send
- Use `Haptics.selectionAsync()` on message long-press
- **iOS caveat**: No haptics in Low Power Mode, during dictation, or while camera is active

### Gesture Handling

- **react-native-gesture-handler** — for swipe-to-reply, long-press menus
- Use `Swipeable` for swipe-to-reply gesture on messages
- Use `LongPressGestureHandler` for message context menus (copy, reply, react, delete)

---

## 9. Animations

### Message Appear/Disappear

Use **react-native-reanimated** layout animations:

```tsx
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";

<Animated.View entering={FadeInDown.duration(300)} exiting={FadeOutUp}>
  <MessageBubble />
</Animated.View>
```

Works with `Animated.FlatList` for list-level animations.

### Typing Indicator

Options:
1. **react-native-typing-animation** — three-dot bouncing animation based on trigonometry
2. **Custom with Reanimated** — animated dots using `withRepeat` + `withSequence`
3. **Gifted Chat built-in** — has default typing indicator (customizable)

### Other Chat Animations

- **Send button**: Scale animation on appear/disappear
- **Message reactions**: Spring animation when adding emoji
- **Read receipts**: Fade-in checkmarks
- **New message indicator**: Slide-up pill at bottom of list
- **Image loading**: Shimmer placeholder → fade-in

### Performance Tips

- Use `react-native-reanimated` (runs on UI thread) over `Animated` API
- Avoid animating layout properties (`height`, `width`) — use `transform` instead
- Use `LayoutAnimation` sparingly — it can conflict with list animations

---

## 10. Accessibility

### Core Requirements for Chat

1. **Message bubbles**: `accessibilityLabel` with sender name, message text, and timestamp
2. **Send button**: `accessibilityRole="button"` + `accessibilityLabel="Send message"`
3. **Input**: `accessibilityLabel="Type a message"` + `accessibilityHint="Double tap to start typing"`
4. **Images**: `accessibilityLabel` describing the image content
5. **Status indicators**: Announce "sent", "delivered", "read" states

### Platform-Specific Screen Readers

| Feature | iOS (VoiceOver) | Android (TalkBack) |
|---------|-----------------|---------------------|
| Navigate | Swipe left/right | Swipe left/right |
| Activate | Double tap | Double tap |
| Scroll | Three-finger swipe | Two-finger swipe |
| Focus order | Position-based | Position-based |

### Key Properties

```tsx
<View
  accessible={true}
  accessibilityRole="text"
  accessibilityLabel={`${sender} said: ${text}, ${timeAgo}`}
>
  <MessageBubble />
</View>
```

### Dynamic Content Announcements

For new messages when the user is not scrolled to bottom:
```tsx
import { AccessibilityInfo } from "react-native";

AccessibilityInfo.announceForAccessibility(
  `New message from ${sender}: ${preview}`
);
```

### Testing

- **iOS**: Settings → Accessibility → VoiceOver
- **Android**: Settings → Accessibility → TalkBack
- Test full chat flow: reading messages, composing, sending, navigating threads

---

## 11. New Expo SDK Features (SDK 52 through 55)

### SDK 52 (November 2024)

| Feature | Chat Benefit |
|---------|-------------|
| **expo/fetch** (WinterCG Fetch) | Download streaming for AI chat responses (SSE/streaming) |
| **React Navigation v7** | Improved navigation patterns, better deep linking for chat threads |
| **New Architecture default in Expo Go** | Test with Fabric in development |
| **React Native DevTools** | Better debugging for WebSocket connections |

### SDK 53 (Early 2025)

| Feature | Chat Benefit |
|---------|-------------|
| **React Native 0.79** | Performance improvements, better Fabric support |
| **New Architecture official** | 74.6% adoption. Required for react-native-enriched. |
| **Edge-to-edge Android (default)** | Full-screen chat experience. Must handle safe areas properly. |
| **expo-audio** (new API) | Cleaner audio recording/playback for voice messages |
| **Improved expo-sqlite** | Better local message persistence and search |

### SDK 54 (September 2025)

| Feature | Chat Benefit |
|---------|-------------|
| **React Native 0.81 + React 19.1** | Precompiled iOS builds (10x faster clean builds) |
| **expo-av deprecated** | Migrate voice messages to expo-audio + expo-video now |
| **Android 16 edge-to-edge mandatory** | Cannot be disabled. react-native-edge-to-edge removed. |
| **expo-file-system new API default** | Object-oriented file handling. Legacy at `expo-file-system/legacy`. |
| **localStorage via expo-sqlite** | Convenient key-value storage for chat preferences |
| **Reanimated v4** | New Architecture only. New `react-native-worklets` package. |
| **expo-notifications cleanup** | Deprecated function exports removed. Update call sites. |
| **Last SDK with Legacy Architecture** | Plan your New Architecture migration before SDK 55. |

### SDK 55 Beta (January 2026)

| Feature | Chat Benefit |
|---------|-------------|
| **React Native 0.83.1 + React 19.2** | Zero breaking changes in RN. New DevTools with perf tracing. |
| **New Architecture mandatory** | No opt-out. All dependencies must support Fabric. |
| **expo-audio: lock-screen + background** | Voice message playback continues on lock screen. Background recording. |
| **expo-image: HDR + SF Symbols** | Richer image display in chat. Native iOS icons. |
| **expo-blur stable on Android** | Reliable blur effects for modals, overlays in chat UI. |
| **Hermes bytecode diffing** | OTA updates ~75% smaller. Faster hot-fixes to chat bugs. |
| **React `<Activity>` component** | Preserve chat screen state when navigating away. No re-mount. |
| **expo-video thumbnails** | Generate video thumbnails natively. expo-video-thumbnails deprecated. |
| **expo-sharing: receive data** | Experimental: accept shared content into your chat app. |

### Migration Notes

- **SDK 53 to 54**: Edge-to-edge becomes mandatory on Android 16. Remove `react-native-edge-to-edge` dependency. Migrate `expo-av` usage to `expo-audio`/`expo-video`. Update `expo-file-system` imports (new API is default). Remove deprecated `expo-notifications` function calls.
- **SDK 54 to 55**: New Architecture is mandatory. Ensure ALL dependencies support Fabric. Upgrade FlashList to v2 (v1 incompatible). Upgrade Reanimated to v4 (or stay on v3 if using NativeWind). `expo-av` is fully removed — migration is required. Test with `useHermesV1` for potential perf gains.

---

## Quick Reference: Recommended Stack

| Concern | Library | Notes |
|---------|---------|-------|
| Message list | **FlashList v2** or **@legendapp/list** | FlashList for proven performance; Legend List for no-native-deps |
| Keyboard | **react-native-keyboard-controller** | KeyboardStickyView for input bar |
| Rich input | **react-native-enriched** | Mentions, bold/italic, links. New Arch only. |
| Plain input | **TextInput multiline** + custom auto-grow | No extra deps needed |
| Images | **expo-image** (display) + **expo-image-picker** | |
| Audio | **expo-audio** (SDK 54+) | Lock-screen controls + background recording in SDK 55. expo-av removed in SDK 55. |
| Gestures | **react-native-gesture-handler** | Swipe-to-reply, long-press menus |
| Animations | **react-native-reanimated** | Layout animations for messages |
| Safe areas | **react-native-safe-area-context** | Essential for edge-to-edge |
| Haptics | **expo-haptics** | Works in Expo Go |
| Notifications | **expo-notifications** | Group by conversation via threadId/groupId |
| State | **Zustand** or **Legend State** | Lightweight, performant |
| Local DB | **expo-sqlite** or **WatermelonDB** | For offline message persistence |

---

## Key Gotchas Summary

1. **Expo Go limitations** — Most chat-critical libraries (keyboard-controller, FlashList native, enriched) need a dev client. Plan for this from day one.
2. **FlashList v2 `inverted` deprecation** — Migrate to `maintainVisibleContentPosition` + reversed data. Test pagination carefully. FlashList v1 is incompatible with SDK 55.
3. **Android notification channels** — Must be created before sending notifications. Can't modify settings after creation.
4. **Edge-to-edge mandatory (SDK 54+)** — Android 16 edge-to-edge cannot be disabled. `react-native-edge-to-edge` package removed. Use `react-native-safe-area-context` for insets.
5. **New Architecture mandatory (SDK 55)** — All dependencies must support Fabric. No opt-out. Check every library before upgrading.
6. **Keyboard interactive dismiss** — Only works on iOS. Android needs different UX.
7. **expo-av removed in SDK 55** — Migrate audio to `expo-audio` and video to `expo-video` before upgrading. No legacy fallback.
8. **Large message histories** — Paginate aggressively. Don't load all messages at once. Use local DB for persistence.
9. **Reanimated v4 + NativeWind** — NativeWind does not yet support Reanimated v4. Stay on v3 if using NativeWind.
10. **expo-file-system API change (SDK 54)** — Default export changed to new object-oriented API. Legacy at `expo-file-system/legacy`.
