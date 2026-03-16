import { STORAGE_KEYS } from './constants'

export function getApiKey(): string | null {
  if (typeof localStorage === 'undefined') return null
  return localStorage.getItem(STORAGE_KEYS.apiKey)
}

export function setApiKey(key: string): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEYS.apiKey, key)
}

export function clearApiKey(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(STORAGE_KEYS.apiKey)
}
