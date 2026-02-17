# Codebase Audit: meet-ai Expo App

> Audited: 2026-02-17 | Auditor: codebase-auditor agent
> Source: `packages/meet-ai-app/src/` (20 files)
> Reference: `docs/PRD.md` (v1.0, Feb 2026) + `docs/expo-chat-app-guide.md`

---

## 1. Current State Summary

### What's Built

The app is a functional real-time chat client with the following working features:

| Area | Status | Details |
|------|--------|---------|
| **Authentication** | Complete | API key login (validates `mai_` prefix), deep link token claiming (`meetaiapp://auth/<token>`), secure storage via `expo-secure-store`, auth-gated routing |
| **Rooms (Lobby)** | Complete | Room list with pull-to-refresh, real-time lobby WebSocket for new rooms, sorted by creation date |
| **Chat (Room)** | Complete | Inverted FlatList message list, real-time WebSocket, exponential backoff reconnection (1s-30s), sequence-based catch-up (`since_seq`), AppState-aware reconnect, markdown rendering, collapsible log groups, color-coded avatars, agent badge, inline browser for links, text input with send, "Reconnecting..." banner |
| **Agents Panel** | Complete | Team info display, per-agent color avatar/name/role/model/status dot, passed via nav params |
| **Settings** | Complete | API key preview (masked), disconnect with confirmation |
| **Theming** | Complete | Light/dark mode (system-automatic), 5 color tokens |

### Key Patterns Used

- **State management**: React Context (auth) + local `useState` per screen. No global state store.
- **Navigation**: expo-router file-based routing with (auth)/(app) groups, Stack navigator.
- **WebSocket**: Two custom hooks — `useLobbyWebSocket` (lobby events) and `useRoomWebSocket` (room messages + team info). Both use refs for stable callbacks, exponential backoff on room WS.
- **Styling**: `StyleSheet.create` throughout. No CSS-in-JS library. Manual theme application via `useTheme()` hook.
- **Markdown**: `@ronradtke/react-native-markdown-display` with extensive custom styles.
- **API layer**: Simple `fetch` wrapper in `lib/api.ts` with `authHeaders()` helper. No caching, no retry, no offline support.

### File Structure (20 files)

```
src/
  app/
    _layout.tsx          # Root: AuthProvider + ThemeProvider + DeepLinkHandler
    (auth)/
      _layout.tsx        # Auth stack (headerless)
      login.tsx          # API key input screen
    (app)/
      _layout.tsx        # App stack with headers
      index.tsx          # Rooms list (lobby)
      rooms/[id].tsx     # Chat screen (503 lines — largest file)
      agents.tsx         # Agent team panel
      settings.tsx       # Settings/disconnect
  components/
    themed-text.tsx      # Reusable themed Text component
    themed-view.tsx      # Reusable themed View component
  constants/
    theme.ts             # Color tokens, Fonts, Spacing constants
  hooks/
    use-color-scheme.ts      # Re-exports RN useColorScheme
    use-color-scheme.web.ts  # Web hydration-safe variant
    use-lobby-websocket.ts   # Lobby WebSocket hook
    use-room-websocket.ts    # Room WebSocket hook
    use-theme.ts             # Returns Colors[light|dark] based on scheme
  lib/
    api.ts               # HTTP + WS URL helpers, SecureStore key mgmt
    auth-context.tsx     # React Context for auth state
    types.ts             # Room, Message, TeamMember, TeamInfo, LobbyEvent types
    colors.ts            # Deterministic hash-to-color (HSL)
  global.css             # CSS custom properties for web fonts
```

### Current Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| expo | ~55.0.0-preview.10 | Framework (SDK 55 Beta) |
| react-native | 0.83.1 | Runtime |
| react | 19.2.0 | UI library |
| expo-router | ~55.0.0-preview.7 | File-based routing |
| expo-secure-store | ~55.0.5 | API key storage |
| expo-web-browser | ~55.0.5 | In-app browser for links |
| expo-linking | ~55.0.4 | Deep link handling |
| expo-image | ~55.0.3 | Installed but NOT used in code |
| expo-glass-effect | ~55.0.5 | Installed but NOT used in code |
| expo-symbols | ~55.0.3 | Installed but NOT used in code |
| react-native-reanimated | ~4.2.1 | Installed but NOT used in code |
| react-native-gesture-handler | ~2.30.0 | Installed but NOT used in code |
| react-native-safe-area-context | ~5.6.2 | Used in login + chat screens |
| react-native-screens | ~4.22.0 | Required by expo-router |
| @ronradtke/react-native-markdown-display | 8.1.0 | Markdown rendering in chat |
| @expo/vector-icons | ^15.0.2 | Ionicons in chat header |
| @react-navigation/native | ^7.1.28 | Navigation framework |
| @react-navigation/elements | ^2.8.1 | Navigation elements |
| react-native-worklets | 0.7.2 | Required by Reanimated v4 |
| react-native-web | ~0.21.0 | Web support |
| react-dom | 19.2.0 | Web support |
| expo-constants | ~55.0.4 | Expo constants |
| expo-device | ~55.0.6 | Device info |
| expo-font | ~55.0.3 | Font loading |
| expo-splash-screen | ~55.0.5 | Splash screen |
| expo-status-bar | ~55.0.2 | Status bar |
| expo-system-ui | ~55.0.5 | System UI |

---

## 2. Gap Analysis

### PRD Feature vs Current Status

| PRD Feature | PRD Section | Status | Notes |
|-------------|-------------|--------|-------|
| **Authentication — API key login** | 2 | Built | Validates `mai_` prefix, SecureStore |
| **Authentication — Deep link token claiming** | 2 | Built | `meetaiapp://auth/<token>` |
| **Authentication — Auth-gated routing** | 2 | Built | (auth)/(app) groups |
| **Authentication — Logout with confirmation** | 2 | Built | Alert dialog |
| **Rooms — Room list** | 2 | Built | FlatList with pull-to-refresh |
| **Rooms — Real-time lobby WebSocket** | 2 | Built | New rooms appear instantly |
| **Chat — Message list** | 2 | Built | FlatList inverted |
| **Chat — Real-time WebSocket** | 2 | Built | Per-room, with reconnection |
| **Chat — Sequence catch-up** | 2 | Built | `since_seq` on reconnect |
| **Chat — AppState-aware** | 2 | Built | Reconnects on foreground |
| **Chat — Markdown rendering** | 2 | Built | Headings, bold, italic, code, links, tables, blockquotes, lists |
| **Chat — Collapsible log groups** | 2 | Built | Consecutive logs fold under parent |
| **Chat — Color-coded avatars** | 2 | Built | Hash-based + explicit `color` |
| **Chat — Agent badge** | 2 | Built | Blue "agent" pill |
| **Chat — Inline browser** | 2 | Built | expo-web-browser |
| **Chat — Text input with send** | 2 | Built | Basic TextInput + send button |
| **Chat — "Reconnecting..." banner** | 2 | Built | Yellow banner |
| **Agents — Team info display** | 2 | Built | Team name, members list |
| **Agents — Per-agent details** | 2 | Built | Name, color, role, model, status dot |
| **Settings — API key preview** | 2 | Built | Masked display |
| **Settings — Disconnect** | 2 | Built | Logout button |
| **Theming — Light/dark mode** | 2 | Built | System-automatic |
| --- | --- | --- | --- |
| **Migrate to FlashList v2** | 4.1 | Missing | Still using FlatList. FlashList not installed. |
| **Memoize message components** | 4.1 | Missing | `renderItem` is inline function, no `React.memo` |
| **Paginate messages** | 4.1 | Missing | Loads ALL messages on mount, no scroll-to-top fetch |
| **Optimistic message sending** | 4.1 | Missing | Waits for server response, no local optimistic insert |
| **Message status indicators** | 4.1 | Missing | No sending/sent/failed states shown |
| **"New messages" pill** | 4.1 | Missing | No tap-to-scroll indicator when scrolled up |
| **Auto-growing input with max height** | 4.2 | Partial | `maxHeight: 120` on style but no `onContentSizeChange` dynamic height |
| **@mentions for agents** | 4.2 | Missing | No mention support |
| **Send button animation** | 4.2 | Missing | Static button, no scale animation |
| **Keyboard handling — keyboard-controller** | 4.2, 4.6 | Missing | Using built-in `KeyboardAvoidingView`, not `react-native-keyboard-controller` |
| **Offline message queue** | 4.3 | Missing | No offline support |
| **Typing indicators** | 4.3 | Missing | No typing indicator |
| **Connection quality indicator** | 4.3 | Missing | Binary "Reconnecting..." only |
| **Background WS grace period** | 4.3 | Missing | Disconnects immediately on background |
| **Image messages** | 4.4 | Missing | Phase 2 — not started |
| **Audio messages** | 4.4 | Missing | Phase 2 — not started |
| **Video messages** | 4.4 | Missing | Phase 2 — not started |
| **File sharing** | 4.4 | Missing | Phase 2 — not started |
| **Push notifications** | 4.5 | Missing | Phase 2 — not started |
| **Room Settings screen** | 8 | Missing | Planned route `/(app)/rooms/[id]/settings` |
| **Profile screen** | 8 | Missing | Planned route `/(app)/profile` |
| **Image Viewer modal** | 8 | Missing | Planned |
| **Message animations (FadeInDown)** | 6 | Missing | Reanimated installed but unused |
| **Haptic feedback** | 6 | Missing | expo-haptics not installed |
| **Accessibility labels** | 6 | Missing | No `accessibilityLabel`, `accessibilityRole`, or `accessibilityHint` on any component |
| **Room creation from mobile** | 9 | Missing | Phase 2 |
| **Message reactions** | 9 | Missing | Phase 2 |
| **Message threading** | 9 | Missing | Phase 2 |
| **Search** | 9 | Missing | Phase 2 |
| **Swipe-to-reply** | 9 | Missing | Phase 2 |
| **Long-press context menu** | 9 | Missing | Phase 2 |

### Summary Counts

| Status | Count |
|--------|-------|
| Built (complete) | 22 |
| Partial | 1 |
| Missing (Phase 1 target) | 16 |
| Missing (Phase 2, deferred) | 12 |

---

## 3. Dependency Audit

### Currently Installed but NOT Used in Code

These packages are in `package.json` but have zero imports in any source file:

| Package | Installed Version | PRD Recommended? | Action |
|---------|------------------|-----------------|--------|
| `expo-image` | ~55.0.3 | Yes (Phase 2 images) | Keep — will be used for image messages |
| `expo-glass-effect` | ~55.0.5 | Mentioned as future | Keep for now — could enhance UI |
| `expo-symbols` | ~55.0.3 | No | Consider removing unless planned |
| `react-native-reanimated` | ~4.2.1 | Yes (animations) | Keep — needed for message animations, FlashList |
| `react-native-gesture-handler` | ~2.30.0 | Yes (swipe-to-reply) | Keep — needed for gesture interactions |
| `react-native-worklets` | 0.7.2 | Required by Reanimated v4 | Keep — peer dep of reanimated |

### PRD-Recommended but NOT Installed

| Package | PRD Version | Purpose | Priority |
|---------|------------|---------|----------|
| `@shopify/flash-list` | ^2.0.0 | Message list (replaces FlatList) | **HIGH** — Phase 1 |
| `react-native-keyboard-controller` | ^1.20.0 | Keyboard handling | **HIGH** — Phase 1 |
| `expo-haptics` | ~55.x | Tactile feedback | **MEDIUM** — Phase 1 |
| `react-native-enriched` | latest | Rich text input with mentions | **MEDIUM** — Phase 1 |
| `expo-image-picker` | ~55.x | Image capture | LOW — Phase 2 |
| `expo-audio` | ~55.x | Voice messages | LOW — Phase 2 |
| `expo-video` | ~55.x | Video playback | LOW — Phase 2 |
| `expo-notifications` | ~55.x | Push notifications | LOW — Phase 2 |
| `expo-sqlite` | ~55.x | Offline message cache | LOW — Phase 2 |
| `@react-native-documents/picker` | latest | File sharing | LOW — Phase 2 |
| `expo-image-manipulator` | ~55.x | Image compression | LOW — Phase 2 |

### Version Compatibility Check

All current deps target SDK 55 Beta versions — no version conflicts detected. The app is on:
- Expo SDK 55 Beta (`~55.0.0-preview.10`)
- React Native 0.83.1
- React 19.2.0
- New Architecture mandatory (correct for SDK 55)
- Reanimated v4 (correct for SDK 55 New Arch)

---

## 4. Code Quality Observations

### Strengths
- Clean separation of concerns (hooks, lib, components, screens)
- Proper use of `useRef` for WebSocket callbacks to avoid stale closures
- Exponential backoff with ceiling on reconnection
- Sequence-based catch-up prevents message loss
- AppState awareness for foreground reconnection
- Good type definitions in `types.ts`

### Issues / Technical Debt

| Issue | Severity | File | Details |
|-------|----------|------|---------|
| `rooms/[id].tsx` is 503 lines | Medium | `rooms/[id].tsx` | Should extract `MessageBubble`, `LogGroup`, `InputBar`, markdown styles into separate files |
| No `React.memo` on list items | Medium | `rooms/[id].tsx` | `renderItem` is inline — re-creates on every render. Message bubbles and log groups should be memoized. |
| All messages loaded at once | High | `rooms/[id].tsx` + `api.ts` | No pagination. `loadMessages()` fetches everything. Will degrade with 500+ messages per PRD perf targets. |
| No optimistic updates | Medium | `rooms/[id].tsx` | `handleSend` waits for server. User sees no immediate feedback. |
| `KeyboardAvoidingView` | Medium | `rooms/[id].tsx`, `login.tsx` | Inconsistent cross-platform. PRD targets `react-native-keyboard-controller`. |
| Hardcoded `BASE_URL` | Low | `api.ts` | `https://meet-ai.cc` is hardcoded. Should be configurable via env/constants for dev vs prod. |
| Hardcoded sender name | Low | `rooms/[id].tsx:346` | `sendMessage(id, 'Mobile User', text)` — sender name should come from user profile or settings |
| Agent panel via nav params | Low | `rooms/[id].tsx` → `agents.tsx` | `teamInfoJson` passed as stringified JSON in nav params. Could be large. Consider a shared state store or context. |
| Lobby WS has no backoff | Low | `use-lobby-websocket.ts` | Fixed 3s reconnect delay vs room WS's exponential backoff |
| `ThemedText` and `ThemedView` unused | Low | `components/` | These components exist but are not imported anywhere except possibly web |
| No error boundaries | Low | All screens | A crash in one screen could take down the whole app |

---

## 5. Priority Recommendations

Ordered by impact and effort — what to tackle first:

### Priority 1: Performance Foundation (HIGH impact, MEDIUM effort)

1. **Install and migrate to FlashList v2** — Replace `FlatList` in `rooms/[id].tsx` with `FlashList`. Use `maintainVisibleContentPosition` + reversed data instead of `inverted`. This is the single biggest performance improvement.
2. **Add message pagination** — Add `?limit=50&before_seq=X` support to `loadMessages`. Implement scroll-to-top pagination in the chat screen.
3. **Memoize message components** — Extract `MessageBubble` and `LogGroup` into `React.memo` wrapped components with stable keys.

### Priority 2: UX Quality (HIGH impact, LOW-MEDIUM effort)

4. **Install react-native-keyboard-controller** — Replace `KeyboardAvoidingView` with `KeyboardStickyView` in chat screen. Smoother keyboard transitions on both platforms.
5. **Optimistic message sending** — Add message to local state immediately with `status: "sending"`, update on server ACK or show retry on failure.
6. **"New messages" pill** — Track scroll position, show a floating pill when new messages arrive while scrolled up.

### Priority 3: Polish (MEDIUM impact, LOW effort)

7. **Message animations** — Use already-installed `react-native-reanimated` for `FadeInDown` on new messages.
8. **Install expo-haptics** — Light impact on send, selection on long-press.
9. **Connection quality indicator** — Replace binary "Reconnecting..." with 3-state: connected / reconnecting / offline.
10. **Refactor `rooms/[id].tsx`** — Extract `MessageBubble`, `LogGroup`, `ChatInputBar`, and markdown styles into separate files. The 503-line monolith is hard to maintain.

### Priority 4: Accessibility (MEDIUM impact, LOW effort)

11. **Add accessibility labels** — `accessibilityLabel` on message bubbles (sender + text + time), send button (`"Send message"`), input field (`"Type a message"`), agent status dots.
12. **Announce new messages** — Use `AccessibilityInfo.announceForAccessibility` when messages arrive while scrolled up.

### Priority 5: Phase 2 Features (defer)

13. Push notifications, image/audio/video messages, offline support, room creation, search, reactions, threading — all deferred per PRD phasing.

---

## Appendix: Unused Dependencies to Review

The following are installed but serve no current purpose. They should either be integrated soon or removed to reduce bundle size:

- `expo-glass-effect` — No usage. Could be used for iOS Liquid Glass UI in future.
- `expo-symbols` — No usage. Could be used for SF Symbols icons on iOS.
- `expo-device` — No direct usage in app code (may be used internally by Expo).
- `expo-constants` — No direct usage in app code.
