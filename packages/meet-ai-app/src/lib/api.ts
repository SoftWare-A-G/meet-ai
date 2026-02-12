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

export async function loadLogs(roomId: string): Promise<Message[]> {
  const res = await request(`/api/rooms/${roomId}/logs`)
  if (!res.ok) return []
  const logs: Message[] = await res.json()
  return logs.map((l) => ({ ...l, type: 'log' as const }))
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
