# meet-ai Mobile App Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a native iOS chat client for meet-ai that connects to the existing REST + WebSocket API.

**Architecture:** Expo 55 + React Native app using direct `fetch` for REST calls and native `WebSocket` for real-time messaging. Auth via `expo-secure-store`. No external state management — React state + `useReducer` only.

**Tech Stack:** Expo 55, React Native 0.83, expo-router (file-based routing), expo-secure-store, TypeScript

**Design doc:** `docs/plans/2026-02-13-meet-ai-mobile-app-design.md`

**Existing web client reference:** `packages/worker/src/client/` — the web chat client has the same API calls and WebSocket hooks. Use these as reference but write React Native code, not Hono JSX.

**IMPORTANT:** Use `bun` (not `npm`), `bunx` (not `npx`). Install deps with `-E` for exact versions. All work happens inside `packages/meet-ai-app/`.

---

### Task 1: Install expo-secure-store

**Files:**
- Modify: `packages/meet-ai-app/package.json`

**Step 1: Install the dependency**

Run from `packages/meet-ai-app/`:
```bash
cd packages/meet-ai-app && bun add -E expo-secure-store
```

**Step 2: Verify it installed**

Run: `grep expo-secure-store packages/meet-ai-app/package.json`
Expected: a line with `"expo-secure-store": "..."` with an exact version (no `^` or `~`)

**Step 3: Commit**

```bash
git add packages/meet-ai-app/package.json packages/meet-ai-app/bun.lock
git commit -m "feat(app): add expo-secure-store for API key storage"
```

---

### Task 2: Create shared types

**Files:**
- Create: `packages/meet-ai-app/src/lib/types.ts`

These types match the server-side types in `packages/worker/src/lib/types.ts` but only include what the mobile client needs.

**Step 1: Create the types file**

```typescript
// packages/meet-ai-app/src/lib/types.ts

export type Room = {
  id: string
  name: string
  created_at: string
}

export type Message = {
  id: string
  room_id: string
  sender: string
  sender_type: 'human' | 'agent'
  content: string
  color: string | null
  type: 'message' | 'log'
  seq: number | null
  created_at: string
}

export type LobbyEvent = {
  type: 'room_created'
  id: string
  name: string
}
```

**Step 2: Verify it compiles**

Run: `cd packages/meet-ai-app && bunx tsc --noEmit src/lib/types.ts`
Expected: no errors

**Step 3: Commit**

```bash
git add packages/meet-ai-app/src/lib/types.ts
git commit -m "feat(app): add API types for rooms and messages"
```

---

### Task 3: Create API client module

**Files:**
- Create: `packages/meet-ai-app/src/lib/api.ts`

Reference: `packages/worker/src/client/lib/api.ts` — same API, but uses `expo-secure-store` instead of `localStorage` and absolute URLs instead of relative paths.

**Step 1: Create the API client**

```typescript
// packages/meet-ai-app/src/lib/api.ts

import * as SecureStore from 'expo-secure-store'
import type { Message, Room } from './types'

const BASE_URL = 'https://meet-ai.cc'
const STORAGE_KEY = 'meet_ai_api_key'

// --- Key storage ---

export async function getStoredKey(): Promise<string | null> {
  return SecureStore.getItemAsync(STORAGE_KEY)
}

export async function setStoredKey(key: string): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEY, key)
}

export async function clearStoredKey(): Promise<void> {
  await SecureStore.deleteItemAsync(STORAGE_KEY)
}

// --- HTTP helpers ---

async function authHeaders(): Promise<Record<string, string>> {
  const key = await getStoredKey()
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (key) h['Authorization'] = `Bearer ${key}`
  return h
}

async function request(path: string, options?: RequestInit): Promise<Response> {
  const headers = await authHeaders()
  return fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...headers, ...options?.headers },
  })
}

// --- API calls ---

export async function loadRooms(): Promise<Room[]> {
  const res = await request('/api/rooms')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function createRoom(name: string): Promise<Room> {
  const res = await request('/api/rooms', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function loadMessages(roomId: string): Promise<Message[]> {
  const res = await request(`/api/rooms/${roomId}/messages`)
  if (!res.ok) return []
  return res.json()
}

export async function loadMessagesSinceSeq(roomId: string, sinceSeq: number): Promise<Message[]> {
  const res = await request(`/api/rooms/${roomId}/messages?since_seq=${sinceSeq}`)
  if (!res.ok) return []
  return res.json()
}

export async function sendMessage(roomId: string, sender: string, content: string): Promise<Message> {
  const res = await request(`/api/rooms/${roomId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ sender, content, sender_type: 'human' }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function claimToken(token: string): Promise<{ api_key: string }> {
  const res = await fetch(`${BASE_URL}/api/auth/claim/${encodeURIComponent(token)}`)
  if (!res.ok) throw new Error('Link expired or invalid')
  return res.json()
}

export function wsUrl(path: string, apiKey: string): string {
  const base = BASE_URL.replace('https://', 'wss://').replace('http://', 'ws://')
  return `${base}${path}?token=${encodeURIComponent(apiKey)}`
}
```

**Step 2: Verify it compiles**

Run: `cd packages/meet-ai-app && bunx tsc --noEmit`
Expected: no errors (or only pre-existing template warnings)

**Step 3: Commit**

```bash
git add packages/meet-ai-app/src/lib/api.ts
git commit -m "feat(app): add API client with secure key storage"
```

---

### Task 4: Create auth context

**Files:**
- Create: `packages/meet-ai-app/src/lib/auth-context.tsx`

This provides the API key to all screens and handles login/logout state transitions.

**Step 1: Create the auth context**

```typescript
// packages/meet-ai-app/src/lib/auth-context.tsx

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { getStoredKey, setStoredKey, clearStoredKey, loadRooms } from './api'

type AuthState = {
  apiKey: string | null
  isLoading: boolean
  login: (key: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState>({
  apiKey: null,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    getStoredKey().then((key) => {
      setApiKey(key)
      setIsLoading(false)
    })
  }, [])

  const login = useCallback(async (key: string) => {
    // Validate by attempting to load rooms
    await setStoredKey(key)
    try {
      await loadRooms()
      setApiKey(key)
    } catch {
      await clearStoredKey()
      throw new Error('Invalid API key')
    }
  }, [])

  const logout = useCallback(async () => {
    await clearStoredKey()
    setApiKey(null)
  }, [])

  return (
    <AuthContext.Provider value={{ apiKey, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
```

**Step 2: Verify it compiles**

Run: `cd packages/meet-ai-app && bunx tsc --noEmit`
Expected: no errors

**Step 3: Commit**

```bash
git add packages/meet-ai-app/src/lib/auth-context.tsx
git commit -m "feat(app): add AuthProvider context with login/logout"
```

---

### Task 5: Clean up template and restructure navigation

Remove the default Expo template screens and set up the route group structure.

**Files:**
- Delete: `packages/meet-ai-app/src/app/index.tsx` (default home)
- Delete: `packages/meet-ai-app/src/app/explore.tsx` (default explore)
- Modify: `packages/meet-ai-app/src/app/_layout.tsx` (root layout with auth gate)
- Create: `packages/meet-ai-app/src/app/(auth)/_layout.tsx`
- Create: `packages/meet-ai-app/src/app/(auth)/login.tsx` (placeholder)
- Create: `packages/meet-ai-app/src/app/(app)/_layout.tsx`
- Create: `packages/meet-ai-app/src/app/(app)/index.tsx` (placeholder)
- Create: `packages/meet-ai-app/src/app/(app)/settings.tsx` (placeholder)

**Step 1: Delete old screens**

```bash
rm packages/meet-ai-app/src/app/index.tsx packages/meet-ai-app/src/app/explore.tsx
```

**Step 2: Rewrite root layout with auth gate**

Replace `packages/meet-ai-app/src/app/_layout.tsx`:

```tsx
// packages/meet-ai-app/src/app/_layout.tsx

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native'
import { Redirect, Slot } from 'expo-router'
import React from 'react'
import { ActivityIndicator, View, useColorScheme } from 'react-native'

import { AuthProvider, useAuth } from '@/lib/auth-context'

function AuthGate() {
  const { apiKey, isLoading } = useAuth()

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  if (!apiKey) {
    return <Redirect href="/(auth)/login" />
  }

  return <Redirect href="/(app)" />
}

function RootLayoutInner() {
  const { apiKey, isLoading } = useAuth()

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  // Slot renders the matched child route
  return <Slot />
}

export default function RootLayout() {
  const colorScheme = useColorScheme()

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <RootLayoutInner />
      </AuthProvider>
    </ThemeProvider>
  )
}
```

**Step 3: Create auth group layout**

```tsx
// packages/meet-ai-app/src/app/(auth)/_layout.tsx

import { Stack } from 'expo-router'
import React from 'react'

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />
}
```

**Step 4: Create placeholder login screen**

```tsx
// packages/meet-ai-app/src/app/(auth)/login.tsx

import React from 'react'
import { Text, View } from 'react-native'

export default function LoginScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Login placeholder</Text>
    </View>
  )
}
```

**Step 5: Create app group layout with tabs**

```tsx
// packages/meet-ai-app/src/app/(app)/_layout.tsx

import { Tabs } from 'expo-router'
import React from 'react'

export default function AppLayout() {
  return (
    <Tabs screenOptions={{ headerShown: true }}>
      <Tabs.Screen name="index" options={{ title: 'Rooms' }} />
      <Tabs.Screen name="rooms/[id]" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  )
}
```

Note: `rooms/[id]` is hidden from the tab bar via `href: null` — it's navigated to programmatically.

**Step 6: Create placeholder rooms list**

```tsx
// packages/meet-ai-app/src/app/(app)/index.tsx

import React from 'react'
import { Text, View } from 'react-native'

export default function RoomsScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Rooms placeholder</Text>
    </View>
  )
}
```

**Step 7: Create rooms/[id] directory and placeholder**

```tsx
// packages/meet-ai-app/src/app/(app)/rooms/[id].tsx

import React from 'react'
import { Text, View } from 'react-native'

export default function ChatScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Chat placeholder</Text>
    </View>
  )
}
```

**Step 8: Create placeholder settings**

```tsx
// packages/meet-ai-app/src/app/(app)/settings.tsx

import React from 'react'
import { Text, View } from 'react-native'

export default function SettingsScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Settings placeholder</Text>
    </View>
  )
}
```

**Step 9: Verify it compiles**

Run: `cd packages/meet-ai-app && bunx tsc --noEmit`
Expected: no errors

**Step 10: Commit**

```bash
git add -A packages/meet-ai-app/src/app/
git commit -m "feat(app): restructure navigation with auth gate and route groups"
```

---

### Task 6: Build the login screen

**Files:**
- Modify: `packages/meet-ai-app/src/app/(auth)/login.tsx`

**Step 1: Implement the full login screen**

```tsx
// packages/meet-ai-app/src/app/(auth)/login.tsx

import { useRouter } from 'expo-router'
import React, { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useTheme } from '@/hooks/use-theme'
import { useAuth } from '@/lib/auth-context'

export default function LoginScreen() {
  const { login } = useAuth()
  const router = useRouter()
  const theme = useTheme()
  const [key, setKey] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleConnect() {
    const trimmed = key.trim()
    if (!trimmed.startsWith('mai_')) {
      Alert.alert('Invalid key', 'API key must start with mai_')
      return
    }

    setLoading(true)
    try {
      await login(trimmed)
      router.replace('/(app)')
    } catch {
      Alert.alert('Connection failed', 'Could not connect with this API key. Check that it is correct.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>meet-ai</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Enter your API key to connect
          </Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}
            placeholder="mai_..."
            placeholderTextColor={theme.textSecondary}
            value={key}
            onChangeText={setKey}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            returnKeyType="go"
            onSubmitEditing={handleConnect}
            editable={!loading}
          />

          <Pressable
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleConnect}
            disabled={loading || !key.trim()}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Connect</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 32,
  },
  header: {
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 16,
  },
  form: {
    gap: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#3c87f7',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
})
```

**Step 2: Verify it compiles**

Run: `cd packages/meet-ai-app && bunx tsc --noEmit`
Expected: no errors

**Step 3: Test manually**

Run: `cd packages/meet-ai-app && bunx expo start --ios`
Expected: app opens, shows login screen with API key input and Connect button.

**Step 4: Commit**

```bash
git add packages/meet-ai-app/src/app/\(auth\)/login.tsx
git commit -m "feat(app): build login screen with API key input"
```

---

### Task 7: Build the rooms list screen

**Files:**
- Modify: `packages/meet-ai-app/src/app/(app)/index.tsx`
- Modify: `packages/meet-ai-app/src/app/(app)/_layout.tsx`

Reference: `packages/worker/src/client/components/sidebar/RoomList/RoomList.tsx` and `packages/worker/src/client/hooks/useLobbyWebSocket.ts`

**Step 1: Create useLobbyWebSocket hook**

```typescript
// packages/meet-ai-app/src/hooks/use-lobby-websocket.ts

import { useEffect, useRef } from 'react'
import { wsUrl } from '@/lib/api'

type LobbyEvent = {
  type: 'room_created'
  id: string
  name: string
}

export function useLobbyWebSocket(
  apiKey: string | null,
  onRoomCreated: (id: string, name: string) => void,
) {
  const wsRef = useRef<WebSocket | null>(null)
  const onRoomCreatedRef = useRef(onRoomCreated)
  onRoomCreatedRef.current = onRoomCreated

  useEffect(() => {
    if (!apiKey) return

    function connect() {
      const ws = new WebSocket(wsUrl('/api/lobby/ws', apiKey!))

      ws.onmessage = (e) => {
        try {
          const evt = JSON.parse(e.data) as LobbyEvent
          if (evt.type === 'room_created') {
            onRoomCreatedRef.current(evt.id, evt.name)
          }
        } catch { /* ignore */ }
      }

      ws.onclose = () => {
        setTimeout(() => {
          if (wsRef.current === ws) connect()
        }, 3000)
      }

      wsRef.current = ws
    }

    connect()

    return () => {
      if (wsRef.current) {
        const ws = wsRef.current
        wsRef.current = null
        ws.close()
      }
    }
  }, [apiKey])
}
```

**Step 2: Implement the rooms list screen**

```tsx
// packages/meet-ai-app/src/app/(app)/index.tsx

import { useRouter } from 'expo-router'
import React, { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { useLobbyWebSocket } from '@/hooks/use-lobby-websocket'
import { useTheme } from '@/hooks/use-theme'
import { createRoom, loadRooms } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import type { Room } from '@/lib/types'

export default function RoomsScreen() {
  const { apiKey } = useAuth()
  const router = useRouter()
  const theme = useTheme()
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')

  const fetchRooms = useCallback(async () => {
    try {
      const data = await loadRooms()
      setRooms(data)
    } catch {
      Alert.alert('Error', 'Failed to load rooms')
    }
  }, [])

  useEffect(() => {
    fetchRooms().finally(() => setLoading(false))
  }, [fetchRooms])

  useLobbyWebSocket(apiKey, (id, name) => {
    setRooms((prev) => {
      if (prev.some((r) => r.id === id)) return prev
      return [...prev, { id, name, created_at: new Date().toISOString() }]
    })
  })

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchRooms()
    setRefreshing(false)
  }, [fetchRooms])

  async function handleCreate() {
    const trimmed = newName.trim()
    if (!trimmed) return
    try {
      const room = await createRoom(trimmed)
      setRooms((prev) => [...prev, room])
      setNewName('')
      setShowCreate(false)
    } catch {
      Alert.alert('Error', 'Failed to create room')
    }
  }

  function renderRoom({ item }: { item: Room }) {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.roomRow,
          { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement },
        ]}
        onPress={() => router.push({ pathname: '/(app)/rooms/[id]', params: { id: item.id, name: item.name } })}
      >
        <Text style={[styles.roomName, { color: theme.text }]}>{item.name}</Text>
        <Text style={[styles.roomDate, { color: theme.textSecondary }]}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </Pressable>
    )
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {showCreate && (
        <View style={[styles.createBar, { backgroundColor: theme.backgroundElement }]}>
          <TextInput
            style={[styles.createInput, { color: theme.text, borderColor: theme.backgroundSelected }]}
            placeholder="Room name..."
            placeholderTextColor={theme.textSecondary}
            value={newName}
            onChangeText={setNewName}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />
          <Pressable style={styles.createButton} onPress={handleCreate}>
            <Text style={styles.createButtonText}>Create</Text>
          </Pressable>
        </View>
      )}

      <FlatList
        data={rooms}
        keyExtractor={(item) => item.id}
        renderItem={renderRoom}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ color: theme.textSecondary }}>No rooms yet</Text>
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, gap: 8 },
  roomRow: {
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roomName: { fontSize: 16, fontWeight: '500' },
  roomDate: { fontSize: 12 },
  empty: { alignItems: 'center', marginTop: 48 },
  createBar: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    alignItems: 'center',
  },
  createInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
  },
  createButton: {
    backgroundColor: '#3c87f7',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  createButtonText: { color: '#fff', fontWeight: '600' },
})
```

**Step 3: Update app layout to add create button in header**

```tsx
// packages/meet-ai-app/src/app/(app)/_layout.tsx

import { Tabs } from 'expo-router'
import React from 'react'

export default function AppLayout() {
  return (
    <Tabs screenOptions={{ headerShown: true }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Rooms',
          headerRight: () => null, // Create button is inline for now
        }}
      />
      <Tabs.Screen name="rooms/[id]" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  )
}
```

**Step 4: Verify it compiles**

Run: `cd packages/meet-ai-app && bunx tsc --noEmit`
Expected: no errors

**Step 5: Test manually**

Run: `cd packages/meet-ai-app && bunx expo start --ios`
Expected: after logging in with a valid key, see the rooms list. Rooms created via CLI appear in real-time.

**Step 6: Commit**

```bash
git add packages/meet-ai-app/src/hooks/use-lobby-websocket.ts packages/meet-ai-app/src/app/\(app\)/index.tsx packages/meet-ai-app/src/app/\(app\)/_layout.tsx
git commit -m "feat(app): build rooms list with lobby WebSocket"
```

---

### Task 8: Build the chat screen

**Files:**
- Modify: `packages/meet-ai-app/src/app/(app)/rooms/[id].tsx`
- Create: `packages/meet-ai-app/src/hooks/use-room-websocket.ts`
- Create: `packages/meet-ai-app/src/lib/colors.ts`

Reference: `packages/worker/src/client/hooks/useRoomWebSocket.ts` and `packages/worker/src/client/components/chat/ChatView/ChatView.tsx`

**Step 1: Create useRoomWebSocket hook**

```typescript
// packages/meet-ai-app/src/hooks/use-room-websocket.ts

import { useEffect, useRef, useState } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { wsUrl, loadMessagesSinceSeq } from '@/lib/api'
import type { Message } from '@/lib/types'

const MIN_BACKOFF = 1000
const MAX_BACKOFF = 30000

export function useRoomWebSocket(
  roomId: string | null,
  apiKey: string | null,
  onMessage: (msg: Message) => void,
) {
  const wsRef = useRef<WebSocket | null>(null)
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage
  const lastSeqRef = useRef<number>(0)
  const backoffRef = useRef<number>(MIN_BACKOFF)
  const [connected, setConnected] = useState(true)

  useEffect(() => {
    if (!roomId || !apiKey) return

    async function catchUp() {
      if (!roomId || lastSeqRef.current === 0) return
      try {
        const missed = await loadMessagesSinceSeq(roomId, lastSeqRef.current)
        for (const msg of missed) {
          if (msg.seq && msg.seq > lastSeqRef.current) {
            lastSeqRef.current = msg.seq
          }
          onMessageRef.current(msg)
        }
      } catch { /* ignore */ }
    }

    function connect() {
      if (wsRef.current) wsRef.current.close()
      const ws = new WebSocket(wsUrl(`/api/rooms/${roomId}/ws`, apiKey!))

      ws.onopen = () => {
        setConnected(true)
        backoffRef.current = MIN_BACKOFF
        catchUp()
      }

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data)
          const msg = data as Message
          if (!msg.sender || !msg.content) return
          if (msg.seq && msg.seq > lastSeqRef.current) {
            lastSeqRef.current = msg.seq
          }
          onMessageRef.current(msg)
        } catch { /* ignore */ }
      }

      ws.onerror = () => console.error('WebSocket error')
      ws.onclose = () => {
        setConnected(false)
        const delay = backoffRef.current
        backoffRef.current = Math.min(delay * 2, MAX_BACKOFF)
        setTimeout(() => {
          if (wsRef.current === ws) connect()
        }, delay)
      }

      wsRef.current = ws
    }

    connect()

    // Reconnect on app foreground (equivalent of visibilitychange)
    function handleAppState(state: AppStateStatus) {
      if (state === 'active') {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          backoffRef.current = MIN_BACKOFF
          connect()
        } else {
          catchUp()
        }
      }
    }

    const subscription = AppState.addEventListener('change', handleAppState)

    return () => {
      subscription.remove()
      if (wsRef.current) {
        const ws = wsRef.current
        wsRef.current = null
        ws.close()
      }
    }
  }, [roomId, apiKey])

  return { connected }
}
```

**Step 2: Create colors utility**

```typescript
// packages/meet-ai-app/src/lib/colors.ts

export function hashColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = ((hash % 360) + 360) % 360
  // Return hex for React Native (no hsl support in some contexts)
  return hslToHex(hue, 60, 45)
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100
  l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}
```

**Step 3: Implement the chat screen**

```tsx
// packages/meet-ai-app/src/app/(app)/rooms/[id].tsx

import { useLocalSearchParams, useNavigation } from 'expo-router'
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useRoomWebSocket } from '@/hooks/use-room-websocket'
import { useTheme } from '@/hooks/use-theme'
import { loadMessages, sendMessage } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import { hashColor } from '@/lib/colors'
import type { Message } from '@/lib/types'

export default function ChatScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>()
  const { apiKey } = useAuth()
  const navigation = useNavigation()
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const flatListRef = useRef<FlatList>(null)

  useLayoutEffect(() => {
    navigation.setOptions({ title: name || 'Chat' })
  }, [navigation, name])

  useEffect(() => {
    if (!id) return
    loadMessages(id).then(setMessages)
  }, [id])

  const handleNewMessage = useCallback((msg: Message) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev
      return [...prev, msg]
    })
  }, [])

  const { connected } = useRoomWebSocket(id ?? null, apiKey, handleNewMessage)

  async function handleSend() {
    const text = input.trim()
    if (!text || !id) return

    setSending(true)
    setInput('')
    try {
      await sendMessage(id, 'Mobile User', text)
    } catch {
      // Restore input on failure
      setInput(text)
    } finally {
      setSending(false)
    }
  }

  function renderMessage({ item }: { item: Message }) {
    const isAgent = item.sender_type === 'agent'
    const senderColor = item.color || hashColor(item.sender)

    return (
      <View style={styles.messageRow}>
        <View style={[styles.avatar, { backgroundColor: senderColor }]}>
          <Text style={styles.avatarText}>
            {item.sender.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.messageContent}>
          <View style={styles.messageHeader}>
            <Text style={[styles.senderName, { color: senderColor }]}>
              {item.sender}
            </Text>
            {isAgent && (
              <View style={styles.agentBadge}>
                <Text style={styles.agentBadgeText}>agent</Text>
              </View>
            )}
            <Text style={[styles.timestamp, { color: theme.textSecondary }]}>
              {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          <Text style={[styles.messageText, { color: theme.text }]}>
            {item.content}
          </Text>
        </View>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {!connected && (
        <View style={styles.reconnectBar}>
          <Text style={styles.reconnectText}>Reconnecting...</Text>
        </View>
      )}

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
      />

      <View style={[styles.inputBar, { paddingBottom: insets.bottom || 8, backgroundColor: theme.backgroundElement }]}>
        <TextInput
          style={[styles.textInput, { color: theme.text, backgroundColor: theme.background }]}
          placeholder="Type a message..."
          placeholderTextColor={theme.textSecondary}
          value={input}
          onChangeText={setInput}
          multiline
          returnKeyType="send"
          blurOnSubmit
          onSubmitEditing={handleSend}
          editable={!sending}
        />
        <Pressable
          style={[styles.sendButton, (!input.trim() || sending) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!input.trim() || sending}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  reconnectBar: {
    backgroundColor: '#f59e0b',
    paddingVertical: 6,
    alignItems: 'center',
  },
  reconnectText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  messageList: { padding: 16, gap: 12 },
  messageRow: {
    flexDirection: 'row',
    gap: 10,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  messageContent: { flex: 1, gap: 2 },
  messageHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  senderName: { fontSize: 13, fontWeight: '600' },
  agentBadge: {
    backgroundColor: 'rgba(59,130,246,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  agentBadgeText: { color: '#3b82f6', fontSize: 10, fontWeight: '600' },
  timestamp: { fontSize: 11 },
  messageText: { fontSize: 15, lineHeight: 21 },
  inputBar: {
    flexDirection: 'row',
    padding: 8,
    gap: 8,
    alignItems: 'flex-end',
  },
  textInput: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 120,
  },
  sendButton: {
    backgroundColor: '#3c87f7',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  sendButtonDisabled: { opacity: 0.4 },
  sendButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
})
```

**Step 4: Verify it compiles**

Run: `cd packages/meet-ai-app && bunx tsc --noEmit`
Expected: no errors

**Step 5: Test manually**

Run: `cd packages/meet-ai-app && bunx expo start --ios`
Expected: login -> rooms list -> tap room -> chat screen with real-time messages. Send a message from CLI and see it appear. Send from app and see it on web.

**Step 6: Commit**

```bash
git add packages/meet-ai-app/src/hooks/use-room-websocket.ts packages/meet-ai-app/src/lib/colors.ts packages/meet-ai-app/src/app/\(app\)/rooms/\[id\].tsx
git commit -m "feat(app): build chat screen with real-time WebSocket"
```

---

### Task 9: Build the settings screen

**Files:**
- Modify: `packages/meet-ai-app/src/app/(app)/settings.tsx`

**Step 1: Implement settings**

```tsx
// packages/meet-ai-app/src/app/(app)/settings.tsx

import { useRouter } from 'expo-router'
import React from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useTheme } from '@/hooks/use-theme'
import { useAuth } from '@/lib/auth-context'

export default function SettingsScreen() {
  const { apiKey, logout } = useAuth()
  const router = useRouter()
  const theme = useTheme()

  const keyPreview = apiKey ? `${apiKey.slice(0, 10)}...${apiKey.slice(-4)}` : 'Not connected'

  function handleLogout() {
    Alert.alert('Disconnect', 'Remove your API key and return to login?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          await logout()
          router.replace('/(auth)/login')
        },
      },
    ])
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.section, { backgroundColor: theme.backgroundElement }]}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>API Key</Text>
        <Text style={[styles.value, { color: theme.text }]}>{keyPreview}</Text>
      </View>

      <Pressable
        style={[styles.logoutButton, { backgroundColor: theme.backgroundElement }]}
        onPress={handleLogout}
      >
        <Text style={styles.logoutText}>Disconnect</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 16 },
  section: {
    padding: 16,
    borderRadius: 12,
    gap: 4,
  },
  label: { fontSize: 13, fontWeight: '500' },
  value: { fontSize: 16, fontFamily: 'monospace' },
  logoutButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  logoutText: { color: '#ef4444', fontSize: 16, fontWeight: '600' },
})
```

**Step 2: Verify it compiles**

Run: `cd packages/meet-ai-app && bunx tsc --noEmit`
Expected: no errors

**Step 3: Commit**

```bash
git add packages/meet-ai-app/src/app/\(app\)/settings.tsx
git commit -m "feat(app): build settings screen with disconnect"
```

---

### Task 10: Add deep link handling

**Files:**
- Modify: `packages/meet-ai-app/src/app/_layout.tsx`

The app already has `scheme: "meetaiapp"` in app.json. We need to handle `meetaiapp://auth/:token` URLs to claim share tokens.

**Step 1: Add deep link handler to root layout**

Update `packages/meet-ai-app/src/app/_layout.tsx` to handle incoming URLs:

```tsx
// packages/meet-ai-app/src/app/_layout.tsx

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native'
import * as Linking from 'expo-linking'
import { Slot, useRouter } from 'expo-router'
import React, { useEffect } from 'react'
import { ActivityIndicator, Alert, View, useColorScheme } from 'react-native'

import { claimToken, setStoredKey } from '@/lib/api'
import { AuthProvider, useAuth } from '@/lib/auth-context'

function DeepLinkHandler() {
  const { login } = useAuth()
  const router = useRouter()

  useEffect(() => {
    function handleUrl(event: { url: string }) {
      const parsed = Linking.parse(event.url)
      // Handle meetaiapp://auth/:token
      if (parsed.path?.startsWith('auth/')) {
        const token = parsed.path.replace('auth/', '')
        if (token) {
          claimToken(token)
            .then(async ({ api_key }) => {
              await login(api_key)
              router.replace('/(app)')
            })
            .catch(() => {
              Alert.alert('Link expired', 'This share link is no longer valid.')
            })
        }
      }
    }

    // Handle URL that opened the app
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl({ url })
    })

    // Handle URLs while app is running
    const subscription = Linking.addEventListener('url', handleUrl)
    return () => subscription.remove()
  }, [login, router])

  return null
}

function RootLayoutInner() {
  const { isLoading } = useAuth()

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  return (
    <>
      <DeepLinkHandler />
      <Slot />
    </>
  )
}

export default function RootLayout() {
  const colorScheme = useColorScheme()

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <RootLayoutInner />
      </AuthProvider>
    </ThemeProvider>
  )
}
```

**Step 2: Verify it compiles**

Run: `cd packages/meet-ai-app && bunx tsc --noEmit`
Expected: no errors

**Step 3: Commit**

```bash
git add packages/meet-ai-app/src/app/_layout.tsx
git commit -m "feat(app): add deep link handling for share tokens"
```

---

### Task 11: Add "+" button to rooms header for creating rooms

**Files:**
- Modify: `packages/meet-ai-app/src/app/(app)/_layout.tsx`
- Modify: `packages/meet-ai-app/src/app/(app)/index.tsx`

The rooms screen already has inline create UI. Let's expose a "+" button in the navigation header that toggles it.

**Step 1: Use a global event or context to toggle create mode**

Simplest approach: use the `headerRight` prop in the layout to render a "+" button, and use expo-router's `useNavigation` in the rooms screen to set the option.

Actually, the simpler approach is to just have the "+" button directly in the rooms screen via `useLayoutEffect` + `navigation.setOptions`. Update `packages/meet-ai-app/src/app/(app)/index.tsx`:

Add to the `RoomsScreen` component (near top of function body, after hooks):

```tsx
useLayoutEffect(() => {
  navigation.setOptions({
    headerRight: () => (
      <Pressable onPress={() => setShowCreate((v) => !v)} style={{ paddingHorizontal: 16 }}>
        <Text style={{ color: '#3c87f7', fontSize: 28, fontWeight: '300' }}>+</Text>
      </Pressable>
    ),
  })
}, [navigation])
```

Add `useLayoutEffect` and `useNavigation` imports.

**Step 2: Verify and commit**

Run: `cd packages/meet-ai-app && bunx tsc --noEmit`

```bash
git add packages/meet-ai-app/src/app/\(app\)/index.tsx
git commit -m "feat(app): add + button in rooms header to create rooms"
```

---

### Task 12: Final cleanup and typecheck

**Files:**
- Delete unused components from template: `packages/meet-ai-app/src/components/hint-row.tsx`, `web-badge.tsx`, `external-link.tsx`, `animated-icon.tsx`, `animated-icon.web.tsx`, `app-tabs.tsx`, `app-tabs.web.tsx`, `ui/collapsible.tsx`
- Delete: `packages/meet-ai-app/src/hooks/use-color-scheme.web.ts` (only needed for web)

**Step 1: Remove unused template files**

```bash
rm packages/meet-ai-app/src/components/hint-row.tsx
rm packages/meet-ai-app/src/components/web-badge.tsx
rm packages/meet-ai-app/src/components/external-link.tsx
rm packages/meet-ai-app/src/components/animated-icon.tsx
rm packages/meet-ai-app/src/components/animated-icon.web.tsx
rm packages/meet-ai-app/src/components/app-tabs.tsx
rm packages/meet-ai-app/src/components/app-tabs.web.tsx
rm packages/meet-ai-app/src/components/ui/collapsible.tsx
```

**Step 2: Full typecheck**

Run: `cd packages/meet-ai-app && bunx tsc --noEmit`
Expected: no errors

**Step 3: Commit**

```bash
git add -A packages/meet-ai-app/src/
git commit -m "chore(app): remove unused Expo template components"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | Install expo-secure-store | package.json |
| 2 | Create shared types | src/lib/types.ts |
| 3 | Create API client | src/lib/api.ts |
| 4 | Create auth context | src/lib/auth-context.tsx |
| 5 | Restructure navigation | src/app/ (auth gate + route groups) |
| 6 | Login screen | src/app/(auth)/login.tsx |
| 7 | Rooms list + lobby WS | src/app/(app)/index.tsx, hooks/use-lobby-websocket.ts |
| 8 | Chat screen + room WS | src/app/(app)/rooms/[id].tsx, hooks/use-room-websocket.ts, lib/colors.ts |
| 9 | Settings screen | src/app/(app)/settings.tsx |
| 10 | Deep link handling | src/app/_layout.tsx |
| 11 | Header "+" button | src/app/(app)/index.tsx |
| 12 | Cleanup template files | Remove unused components |
