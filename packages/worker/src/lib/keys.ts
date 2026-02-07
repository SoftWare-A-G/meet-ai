const KEY_PREFIX = 'mai_'
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

export function generateKey(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  let id = ''
  for (let i = 0; i < 24; i++) {
    id += ALPHABET[bytes[i] % ALPHABET.length]
  }
  return KEY_PREFIX + id
}

export async function hashKey(key: string): Promise<string> {
  const data = new TextEncoder().encode(key)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export function keyPrefix(key: string): string {
  return key.slice(0, 8)
}
