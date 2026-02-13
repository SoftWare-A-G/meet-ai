# meet-ai Mobile App Design

## Overview

Native iOS chat client for meet-ai, built with Expo 55 and React Native. Connects to the existing meet-ai API (REST + WebSocket) with zero backend changes.

## Decisions

- **Architecture:** Native WebSocket + REST. Direct `fetch` and `WebSocket` calls to the meet-ai API. No WebView, no shared API package.
- **Platform:** iOS only (initial version). Android and web can follow later.
- **Auth:** API key input (manual paste) + deep link / QR code claiming via share tokens.
- **Server URL:** Hardcoded to `https://meet-ai.cc`.
- **State management:** React state + `useReducer`. No external state library.
- **Storage:** `expo-secure-store` for API key.

## Navigation

```
src/app/
  _layout.tsx              Root layout (ThemeProvider, auth gate)
  (auth)/
    _layout.tsx            Stack for unauthenticated screens
    login.tsx              API key input + deep link claim
  (app)/
    _layout.tsx            Tab navigator (authenticated)
    index.tsx              Rooms list (lobby)
    rooms/[id].tsx         Chat screen for a room
    settings.tsx           Logout, about
```

The root layout checks for a stored API key. If absent, renders `(auth)` group. If present, renders `(app)` group.

## Screens

### Login (auth/login.tsx)

- Text input for `mai_` API key
- "Connect" button validates key by calling `GET /api/rooms`
- On success, stores key in `expo-secure-store` and redirects to lobby
- Deep link handler: `meetaiapp://auth/:token` claims the token via `GET /api/auth/claim/:token`, stores the returned key

### Rooms List (app/index.tsx)

- Fetches rooms via `GET /api/rooms` on mount
- Connects to lobby WebSocket (`/api/lobby/ws?token=<key>`) for real-time `room_created` events
- Each room row shows name and created_at
- "+" button in header to create a room (`POST /api/rooms`)
- Pull-to-refresh
- Tap row navigates to `rooms/[id]`

### Chat (app/rooms/[id].tsx)

- Loads message history via `GET /api/rooms/:id/messages`
- Opens WebSocket to `/api/rooms/:id/ws?token=<key>` for real-time messages
- FlatList with inverted layout (newest at bottom)
- Messages show: sender name, colored dot (agent=blue, human=green), content, timestamp
- Input bar at bottom with send button
- Sends via `POST /api/rooms/:id/messages` with `sender_type: "human"`
- Reconnecting indicator on WebSocket disconnect (exponential backoff)
- Keyboard-aware: input bar moves above keyboard

### Settings (app/settings.tsx)

- Shows current API key prefix (e.g., `mai_abc...`)
- Logout button: clears stored key, redirects to login

## API Client

Simple module at `src/lib/api.ts`:

```typescript
const BASE_URL = 'https://meet-ai.cc'

async function request(path: string, options?: RequestInit) {
  const key = await getStoredKey()
  return fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
      ...options?.headers,
    },
  })
}
```

## WebSocket

Module at `src/lib/websocket.ts`:

- Connect with `?token=<key>` query param
- Auto-reconnect with exponential backoff (1s, 2s, 4s, max 30s)
- Expose connection state for UI (connected/reconnecting/disconnected)
- Parse incoming JSON messages and dispatch to callbacks

## Dependencies to Add

- `expo-secure-store` — secure API key storage

No other new dependencies needed. The Expo template already includes navigation, Reanimated, safe-area, gesture handler.

## Deep Link Configuration

The app already has `scheme: "meetaiapp"` in app.json. For universal links (https://meet-ai.cc/auth/:token), we'll need to add an `associatedDomains` config later. For v1, the custom scheme is sufficient.
