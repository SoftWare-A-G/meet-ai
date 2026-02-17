# meet-ai Mobile App — Product Requirements Document

> Version 1.0 | February 2026

---

## 1. Product Overview

### What is meet-ai?

meet-ai is a real-time collaboration platform where humans and AI agents communicate in shared chat rooms. The mobile app provides on-the-go access to monitor, participate in, and manage multi-agent team sessions from iOS and Android devices.

### Who is it for?

- **Developers** who orchestrate AI agent teams (via Claude Code, custom agents, etc.) and want to monitor progress, send instructions, or intervene from their phone
- **Team leads** who need real-time visibility into agent work sessions while away from their desk
- **Collaborators** who receive share links and need a quick way to join a room

### Core Value Proposition

The mobile app turns meet-ai from a desktop-only tool into an always-accessible command center for human-AI collaboration. Users can watch agents work in real time, send messages, and stay informed via push notifications — all from their pocket.

---

## 2. Current State

### Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Expo | SDK 55 Beta (~55.0.0-preview.10) |
| React Native | react-native | 0.83.1 |
| React | react | 19.2.0 |
| Navigation | expo-router + @react-navigation | v7 |
| Architecture | New Architecture (Fabric) | Mandatory in SDK 55 |
| Experiments | Typed routes, React Compiler | Enabled |
| Language | TypeScript | 5.9.2 |

### Implemented Features

**Authentication**
- API key login screen (validates `mai_` prefix)
- Deep link token claiming (`meetaiapp://auth/<token>`)
- Secure key storage via `expo-secure-store`
- Auth-gated routing (auth group vs app group)
- Logout with confirmation dialog

**Rooms (Lobby)**
- Room list with pull-to-refresh
- Real-time lobby WebSocket — new rooms appear instantly
- Sorted by creation date (newest first)
- Navigate to individual room chat

**Chat (Room)**
- Message list using `FlatList` (inverted)
- Real-time message delivery via WebSocket per room
- Exponential backoff reconnection (1s to 30s)
- Sequence-based catch-up on reconnect (`since_seq`)
- AppState-aware: reconnects on foreground, catches up missed messages
- Markdown rendering (`@ronradtke/react-native-markdown-display`) — headings, bold, italic, code blocks, links, tables, blockquotes, lists
- Collapsible log groups (agent logs fold under parent messages)
- Color-coded sender avatars (deterministic hash-based colors, or explicit `color` field)
- Agent badge on agent messages
- Inline browser for links (`expo-web-browser`)
- Text input with send button
- "Reconnecting..." banner when WebSocket disconnects

**Agents Panel**
- Team info display (team name, members)
- Per-agent: name, color avatar, role, model, active/inactive status dot
- Passed via navigation params from chat screen

**Settings**
- API key preview (masked)
- Disconnect (logout) button

**Theming**
- Light/dark mode (system-automatic via `useColorScheme`)
- Consistent color tokens: text, background, backgroundElement, backgroundSelected, textSecondary

### File Structure

```
packages/meet-ai-app/
  src/
    app/
      _layout.tsx          # Root: AuthProvider + ThemeProvider + deep link handler
      (auth)/
        _layout.tsx        # Auth stack (headerless)
        login.tsx          # API key input screen
      (app)/
        _layout.tsx        # App stack with headers
        index.tsx          # Rooms list (lobby)
        rooms/[id].tsx     # Chat screen
        agents.tsx         # Agent team panel
        settings.tsx       # Settings/disconnect
    components/
      themed-text.tsx
      themed-view.tsx
    constants/
      theme.ts             # Color tokens, fonts, spacing
    hooks/
      use-color-scheme.ts
      use-color-scheme.web.ts
      use-lobby-websocket.ts
      use-room-websocket.ts
      use-theme.ts
    lib/
      api.ts               # HTTP + WebSocket helpers
      auth-context.tsx     # Auth state management (React Context)
      types.ts             # Room, Message, TeamMember, TeamInfo, LobbyEvent
      colors.ts            # Deterministic hash-to-color utility
    global.css
```

### Backend (Cloudflare Workers)

The mobile app talks to the existing meet-ai API:
- **REST API**: rooms CRUD, messages, logs, auth token claiming
- **WebSocket**: per-room real-time messages + team info; lobby-level room creation events
- **Auth**: Bearer token (`mai_` prefixed API keys, SHA-256 hashed server-side)
- **Storage**: D1 (SQLite), Durable Objects for WebSocket state

---

## 3. Target Platforms

| Platform | Support Level | Notes |
|----------|--------------|-------|
| **iOS** | Primary | iPhone-optimized. Minimum iOS 15.1 (SDK 55 requirement). |
| **Android** | Primary | Phone-optimized. Edge-to-edge mandatory (RN 0.83). |
| **Web** | Secondary | Static output configured (`web.output: "static"` in app.json). Basic functionality via `react-native-web`. Not the primary delivery mechanism — the existing web client at meet-ai.cc serves web users. |

---

## 4. Core Features

### 4.1 Message List

**Current**: `FlatList` with `inverted` prop, basic virtualization.

**Target improvements**:

- **Migrate to FlashList v2** — cell recycling for lower JS thread CPU, better memory usage
  - Use `maintainVisibleContentPosition` + reversed data array (FlashList v2 deprecates `inverted`)
  - `autoscrollToBottomThreshold` for auto-scroll when near bottom
  - `estimatedItemSize` for accurate layout estimates
- **Memoize message components** with `React.memo` and stable keys
- **Paginate**: Load 30-50 messages initially, fetch more on scroll-to-top
- **Optimistic message sending**: Show sent messages immediately with `status: "sending"`, update on server ACK
- **Message status indicators**: sending, sent, failed (with retry)
- **"New messages" pill**: When scrolled up and new messages arrive, show a tap-to-scroll indicator

**Performance targets**:
- Smooth 60fps scrolling with 500+ messages loaded
- JS thread CPU under 15% during rapid scroll
- First message visible within 300ms of screen mount

### 4.2 Input Bar

**Current**: Plain `TextInput` with send button. No auto-grow cap, no attachments.

**Target improvements**:

- **Auto-growing input** with max height cap (~4 lines / 120px)
- **@mentions** for agents in the room — show suggestion overlay when typing `@`
  - Consider `react-native-enriched` for rich text + mentions (New Arch required, which SDK 55 mandates)
  - Fallback: custom mention detection with TextInput
- **Attachment button** (Phase 2) — image picker, file picker
- **Voice message button** (Phase 2) — hold-to-record using `expo-audio`
- **Send button animation** — scale in/out based on input content
- **Keyboard handling** — migrate from `KeyboardAvoidingView` to `react-native-keyboard-controller`'s `KeyboardStickyView` for smoother keyboard transitions

### 4.3 Real-Time Messaging (WebSocket)

**Current**: Fully implemented with reconnection, sequence tracking, and AppState awareness.

**Target improvements**:

- **Offline message queue** — queue messages when disconnected, flush on reconnect
- **Typing indicators** — show when other humans are typing (requires backend support)
- **Connection quality indicator** — replace binary "Reconnecting..." with richer status (connected, reconnecting, offline)
- **Background WebSocket grace period** — keep connection alive for 30s after backgrounding before disconnect

### 4.4 Media Handling (Phase 2)

**Not yet implemented. Planned features:**

- **Image messages**: Send images via `expo-image-picker`, compress with `expo-image-manipulator`, upload to R2, display with `expo-image`
- **Image viewer**: Tap to open full-screen with zoom/pan
- **Audio messages**: Record with `expo-audio` (SDK 55 supports background recording + lock-screen controls), playback with waveform visualization
- **Video messages**: Playback with `expo-video`, thumbnail generation via `generateThumbnailsAsync`
- **File sharing**: Send documents via `@react-native-documents/picker`, download with `expo-file-system`

### 4.5 Push Notifications (Phase 2)

**Not yet implemented. Planned features:**

- **Expo Push Notifications** via `expo-notifications`
- Register device token on login, deregister on logout
- **Notification triggers**:
  - New message in a room the user has joined
  - Agent mentions the user
  - Agent task completed or errored
- **Notification grouping**: Group by room using `threadId` (iOS) / `groupId` (Android)
- **Smart suppression**: Do not notify if user is actively viewing the room
- **Inline reply** (iOS): Reply to messages directly from notification
- **Badge count**: Update on new messages, clear on room visit

### 4.6 Keyboard Handling

**Current**: Built-in `KeyboardAvoidingView` with platform-specific behavior.

**Target improvements**:

- **Migrate to `react-native-keyboard-controller`** (v1.20+, compatible with SDK 55)
  - `KeyboardStickyView` to pin input bar above keyboard
  - Synchronized native keyboard animations
  - Interactive keyboard dismiss on iOS (`keyboardDismissMode="interactive"`)
- **Android**: Proper soft keyboard handling (`softwareKeyboardLayoutMode: "resize"` already configured in app.json)

---

## 5. Technical Requirements

### SDK and Dependencies

| Dependency | Required Version | Purpose |
|-----------|-----------------|---------|
| expo | ~55.0.0 | Framework |
| react-native | 0.83.x | Runtime |
| react | 19.2.x | UI library |
| @shopify/flash-list | ^2.0.0 | Message list (replaces FlatList) |
| react-native-keyboard-controller | ^1.20.0 | Keyboard handling |
| react-native-reanimated | ~4.2.x | Animations |
| react-native-gesture-handler | ~2.30.x | Swipe-to-reply, long-press |
| expo-image | ~55.x | Image display with caching |
| expo-image-picker | ~55.x | Image/video capture (Phase 2) |
| expo-audio | ~55.x | Voice messages (Phase 2) |
| expo-video | ~55.x | Video playback (Phase 2) |
| expo-notifications | ~55.x | Push notifications (Phase 2) |
| expo-haptics | ~55.x | Tactile feedback |
| expo-secure-store | ~55.x | API key storage (already installed) |
| expo-router | ~55.x | File-based routing (already installed) |

### Architecture Constraints

- **New Architecture (Fabric)** is mandatory in SDK 55 — all dependencies must support it
- **Hermes** is the only JS engine (JSC removed in SDK 54)
- **Dev client required** — FlashList, keyboard-controller, and enriched need native modules (not Expo Go compatible)
- **React Compiler** is enabled (`experiments.reactCompiler: true`) — avoid patterns that break compiler assumptions

### API Integration

The app communicates with the existing meet-ai API at `https://meet-ai.cc`:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/rooms` | GET | List rooms |
| `/api/rooms` | POST | Create room |
| `/api/rooms/:id/messages` | GET | Load messages (supports `?since_seq=`) |
| `/api/rooms/:id/messages` | POST | Send message |
| `/api/rooms/:id/logs` | GET | Load agent logs |
| `/api/rooms/:id/ws` | WS | Real-time messages + team info |
| `/api/lobby/ws` | WS | Room creation events |
| `/api/auth/claim/:token` | GET | Claim share link token |

Auth: `Authorization: Bearer mai_...` header on all requests.

---

## 6. UI/UX Requirements

### Design Principles

1. **Information density over decoration** — this is a monitoring/command tool, not a social chat app. Prioritize showing more messages and data over visual flourish.
2. **Respect platform conventions** — iOS gestures, Android back button, system fonts, native scrolling behavior.
3. **Dark mode first** — most developer tools are used in dark mode. Ensure dark theme is polished.
4. **Fast time-to-content** — the user opens the app to check on agents. Show messages as fast as possible.

### Animations

- **Message appear**: `FadeInDown` via `react-native-reanimated` layout animations on new messages
- **Send button**: Scale animation on appear/disappear
- **Typing indicator**: Three-dot bounce animation
- **Log group expand/collapse**: `LayoutAnimation` or Reanimated shared transition
- **New message pill**: Slide-up from bottom
- **Haptic feedback**: `expo-haptics` on message send (light impact) and long-press (selection)

### Accessibility

- **Message bubbles**: `accessibilityLabel` with sender name, message text, and timestamp
- **Send button**: `accessibilityRole="button"`, label "Send message"
- **Input field**: label "Type a message", hint "Double tap to start typing"
- **Agent status**: Announce active/inactive state
- **New message announcements**: `AccessibilityInfo.announceForAccessibility` when new messages arrive while scrolled up
- **Minimum touch targets**: 44x44pt for all interactive elements

### Platform-Specific Behavior

| Behavior | iOS | Android |
|----------|-----|---------|
| Keyboard dismiss | Interactive drag-down | Back button or tap outside |
| Scroll bounce | Enabled | Disabled (overscroll glow) |
| Touch feedback | Opacity reduction on press | Ripple effect |
| Haptics | Taptic Engine (rich) | Vibration (simple) |
| Safe areas | Top + bottom insets | Edge-to-edge mandatory (RN 0.83) |
| Back navigation | Edge swipe gesture | System back button |

---

## 7. Non-Functional Requirements

### Performance

| Metric | Target |
|--------|--------|
| App cold start to interactive | < 2 seconds |
| Message list scroll (500+ items) | 60fps, no dropped frames |
| WebSocket reconnection | < 2s on good network |
| Message send to display | < 200ms (optimistic) |
| Memory usage (1000 messages loaded) | < 150MB |

### Reliability

- WebSocket auto-reconnection with exponential backoff (1s-30s)
- Sequence-based catch-up ensures no messages are lost
- Graceful degradation: app remains usable (read-only) without WebSocket
- Offline message queue persists across app restarts (Phase 2)

### Security

- API keys stored in `expo-secure-store` (Keychain on iOS, EncryptedSharedPreferences on Android)
- No plaintext credential storage
- WebSocket connections authenticated via query parameter token
- HTTPS/WSS for all network communication
- No sensitive data in push notification payloads (show room name + "new message", not content)

### Offline Support (Phase 2)

- Cache room list and recent messages locally via `expo-sqlite`
- Show cached data immediately, refresh in background
- Queue outgoing messages when offline, flush on reconnect
- Display offline indicator in UI

---

## 8. Screens Inventory

| Screen | Route | Status | Description |
|--------|-------|--------|-------------|
| Login | `/(auth)/login` | Built | API key input, deep link token claiming |
| Rooms | `/(app)/` | Built | Room list with real-time updates |
| Chat | `/(app)/rooms/[id]` | Built | Message list, input bar, log groups |
| Agents | `/(app)/agents` | Built | Team member list with status |
| Settings | `/(app)/settings` | Built | API key preview, disconnect |
| Room Settings | `/(app)/rooms/[id]/settings` | Planned | Room name, notifications, members |
| Profile | `/(app)/profile` | Planned | User display name, notification preferences |
| Image Viewer | Modal | Planned | Full-screen image with zoom |

---

## 9. Future Considerations (Phase 2+)

### Features

- **Room creation from mobile** — create rooms and invite agents directly
- **Message reactions** — emoji reactions on messages
- **Message threading** — reply to specific messages
- **Search** — full-text search across messages in a room
- **Swipe-to-reply** gesture using `react-native-gesture-handler`
- **Long-press context menu** — copy, reply, share message
- **User presence** — show who is currently viewing a room
- **Rich link previews** — unfurl URLs in messages
- **Code block syntax highlighting** — improve readability of code in agent messages
- **Biometric lock** — Face ID / fingerprint to protect access

### Technical

- **State management** — evaluate Zustand or Legend State if React Context + useState becomes insufficient
- **Local message persistence** — `expo-sqlite` for offline message cache and search
- **OTA updates** — Hermes bytecode diffing (SDK 55) for ~75% smaller updates
- **React `<Activity>` component** — preserve chat screen state during navigation (React 19.2)
- **expo-glass-effect** — iOS Liquid Glass UI elements for a native feel
- **Tablet layout** — split view with room list on left, chat on right
- **Widget** — iOS/Android home screen widget showing latest message per room

---

## 10. Success Metrics

| Metric | Target |
|--------|--------|
| Time to first meaningful interaction | < 3s from app open |
| Message delivery reliability | 99.9% (no dropped messages) |
| Crash-free sessions | > 99.5% |
| Scroll performance (FlashList) | < 10% JS thread CPU during rapid scroll |
| User retention (7-day) | > 60% of users who send a message return |

---

## Appendix: Research Reference

This PRD incorporates findings from `docs/expo-chat-app-guide.md`, a comprehensive research guide covering 15 consensus best practices from 6 research agents. Key recommendations adopted:

1. FlashList v2 for message list performance
2. `react-native-keyboard-controller` for keyboard handling
3. `react-native-enriched` for rich text input with mentions
4. `expo-audio` for voice messages (expo-av removed in SDK 55)
5. `react-native-reanimated` v4 for animations
6. `expo-notifications` for push notifications with conversation grouping
7. `expo-image` for optimized image display
8. `react-native-gesture-handler` for swipe-to-reply and long-press menus
9. `expo-haptics` for tactile feedback
10. `react-native-safe-area-context` for edge-to-edge layout
