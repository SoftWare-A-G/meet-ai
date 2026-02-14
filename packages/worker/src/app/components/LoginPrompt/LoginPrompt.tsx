import React, { useState, useCallback, useRef, useEffect } from 'react'
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
    } catch (error: any) {
      setError(error.message || 'Connection error. Try again.')
      setLoading(false)
    }
  }, [onLogin])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); handleLogin() }
  }, [handleLogin])

  return (
    <div className="flex-1 flex flex-col bg-chat-bg text-msg-text min-w-0 h-dvh">
      <div className="flex-1 flex items-center justify-center flex-col gap-4 p-6">
        <h2 className="text-xl font-bold text-[#C9D1D9]">Welcome to meet-ai</h2>
        <p className="text-sm text-[#8B949E] text-center max-w-[360px]">Paste a login link from another device or enter your API key to continue.</p>
        <div className="flex gap-2 w-full max-w-[420px]">
          <input
            ref={inputRef}
            type="text"
            placeholder="Paste login link or API key"
            autoComplete="off"
            spellCheck={false}
            onKeyDown={handleKeyDown}
            className="flex-1 min-w-0 h-[42px] px-3 border border-[#30363D] rounded-lg bg-[#161B22] text-[#C9D1D9] text-sm outline-none placeholder:text-[#8B949E] focus:border-primary"
          />
          <button type="button" onClick={handleLogin} disabled={loading} className="h-[42px] px-5 border-none rounded-lg bg-primary text-primary-text text-sm font-semibold cursor-pointer shrink-0 hover:brightness-110">
            {loading ? '...' : 'Go'}
          </button>
        </div>
        <div className="text-[#F85149] text-[13px] min-h-[18px]">{error}</div>
        <div className="text-[13px] text-[#8B949E]">or <a href="/" className="text-primary underline cursor-pointer">get an API key</a></div>
      </div>
    </div>
  )
}
