import { useState, useCallback, useRef, useEffect } from 'hono/jsx/dom'
import * as api from '../../lib/api'

type LoginPromptProps = {
  onLogin: (key: string) => void
}

export default function LoginPrompt({ onLogin }: LoginPromptProps) {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleLogin = useCallback(async () => {
    const val = inputRef.current?.value.trim()
    if (!val) return
    setError('')
    setLoading(true)

    try {
      if (val.startsWith('http') && val.includes('/auth/')) {
        const token = val.split('/auth/').pop()?.split('?')[0]?.split('#')[0]
        if (!token) { setError('Invalid link'); setLoading(false); return }
        const data = await api.claimToken(token)
        onLogin(data.api_key)
      } else if (val.startsWith('mai_')) {
        onLogin(val)
      } else {
        setError('Invalid link or key')
        setLoading(false)
      }
    } catch (e: any) {
      setError(e.message || 'Connection error. Try again.')
      setLoading(false)
    }
  }, [onLogin])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleLogin() }
  }, [handleLogin])

  return (
    <div class="main" style="height:100dvh">
      <div class="login-prompt">
        <h2>Welcome to meet-ai</h2>
        <p>Paste a login link from another device or enter your API key to continue.</p>
        <div class="login-prompt-form">
          <input
            ref={inputRef}
            type="text"
            placeholder="Paste login link or API key"
            autocomplete="off"
            spellcheck={false}
            onKeyDown={handleKeyDown}
          />
          <button onClick={handleLogin} disabled={loading}>
            {loading ? '...' : 'Go'}
          </button>
        </div>
        <div class="login-error">{error}</div>
        <div class="login-or">or <a href="/">get an API key</a></div>
      </div>
    </div>
  )
}
