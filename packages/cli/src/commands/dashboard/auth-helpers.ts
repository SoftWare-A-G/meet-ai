/**
 * Helper functions for the auth modal — input parsing, auth-link claiming.
 * Kept separate from the Ink component for testability.
 */

const DEFAULT_URL = 'https://meet-ai.cc'

export interface AuthResult {
  url: string
  key: string
  envName: string
}

/**
 * Extract the claim token from an auth link URL.
 * Accepts full URLs like `https://meet-ai.cc/auth/abc123` or bare paths `/auth/abc123`.
 */
export function extractClaimToken(input: string): string | null {
  const trimmed = input.trim()

  // Try as full URL first
  try {
    const url = new URL(trimmed)
    const match = url.pathname.match(/^\/auth\/([a-zA-Z0-9_-]+)$/)
    return match?.[1] ?? null
  } catch {
    // Not a valid URL — try as bare path
  }

  const pathMatch = trimmed.match(/^\/auth\/([a-zA-Z0-9_-]+)$/)
  return pathMatch?.[1] ?? null
}

/**
 * Returns true when the input looks like a direct API key.
 */
export function isDirectKey(input: string): boolean {
  return input.trim().startsWith('mai_')
}

/**
 * Claim an API key from an auth link token.
 */
export async function claimAuthToken(
  baseUrl: string,
  token: string,
): Promise<{ api_key: string }> {
  const url = `${baseUrl.replace(/\/+$/, '')}/api/auth/claim/${encodeURIComponent(token)}`
  const res = await fetch(url, { method: 'GET' })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Claim failed (${res.status}): ${body || res.statusText}`)
  }

  const json = (await res.json()) as { api_key?: string }
  if (!json.api_key) {
    throw new Error('Claim response missing api_key')
  }

  return { api_key: json.api_key }
}

/**
 * Derive a short env name from a URL (e.g. "meet-ai.cc" → "meet-ai-cc").
 */
export function deriveEnvName(url: string): string {
  try {
    const hostname = new URL(url).hostname
    return hostname.replace(/\./g, '-')
  } catch {
    return 'default'
  }
}

/**
 * Parse and resolve the key/auth-link input into a usable API key.
 * - Direct `mai_*` key → returned as-is
 * - Auth link → claimed via the API
 * - Anything else → error
 */
export async function resolveKeyInput(
  baseUrl: string,
  keyInput: string,
): Promise<string> {
  const trimmed = keyInput.trim()

  if (!trimmed) {
    throw new Error('Key or auth link is required')
  }

  if (isDirectKey(trimmed)) {
    return trimmed
  }

  const token = extractClaimToken(trimmed)
  if (token) {
    const result = await claimAuthToken(baseUrl, token)
    return result.api_key
  }

  throw new Error('Invalid input — enter a mai_ key or an /auth/<token> link')
}

export { DEFAULT_URL }
