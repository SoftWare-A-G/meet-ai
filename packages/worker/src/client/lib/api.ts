import { STORAGE_KEYS } from './constants'
import type { Message, Room } from './types'

export function getApiKey(): string | null {
  return localStorage.getItem(STORAGE_KEYS.apiKey)
}

export function setApiKey(key: string): void {
  localStorage.setItem(STORAGE_KEYS.apiKey, key)
}

export function clearApiKey(): void {
  localStorage.removeItem(STORAGE_KEYS.apiKey)
}

function authHeaders(): Record<string, string> {
  const key = getApiKey()
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (key) h['Authorization'] = 'Bearer ' + key
  return h
}

export async function loadRooms(): Promise<Room[]> {
  const res = await fetch('/api/rooms', { headers: authHeaders() })
  if (res.status === 401) {
    clearApiKey()
    location.href = '/key'
    return []
  }
  return res.json()
}

export async function loadMessages(roomId: string): Promise<Message[]> {
  const res = await fetch(`/api/rooms/${roomId}/messages`, { headers: authHeaders() })
  if (!res.ok) return []
  return res.json()
}

export async function loadLogs(roomId: string): Promise<Message[]> {
  const res = await fetch(`/api/rooms/${roomId}/logs`, { headers: authHeaders() })
  if (!res.ok) return []
  const logs: Message[] = await res.json()
  return logs.map(l => ({ ...l, type: 'log' as const }))
}

export async function sendMessage(roomId: string, sender: string, content: string): Promise<void> {
  const res = await fetch(`/api/rooms/${roomId}/messages`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ sender, content }),
  })
  if (!res.ok) throw new Error('HTTP ' + res.status)
}

export async function claimToken(token: string): Promise<{ api_key: string }> {
  const res = await fetch('/api/auth/claim/' + encodeURIComponent(token))
  if (!res.ok) throw new Error('Link expired or invalid')
  return res.json()
}

export async function shareAuth(): Promise<{ url: string }> {
  const res = await fetch('/api/auth/share', {
    method: 'POST',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('Failed to create share link')
  return res.json()
}
