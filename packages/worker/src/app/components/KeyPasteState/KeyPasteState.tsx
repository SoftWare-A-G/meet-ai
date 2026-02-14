import { useState, useCallback, useRef, useEffect } from 'react'
import type React from 'react'
import KeyHeadline from '../KeyHeadline'

type KeyPasteStateProps = {
  onConnect: (key: string) => void
  onBack: () => void
}

export default function KeyPasteState({ onConnect, onBack }: KeyPasteStateProps) {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus()
    }, 400)
    return () => clearTimeout(timer)
  }, [])

  const connectWithKey = useCallback(async () => {
    const value = inputRef.current?.value.trim() || ''

    if (!value) {
      setError('Please paste your key or login link.')
      return
    }

    setError('')

    if (value.startsWith('http') && value.includes('/auth/')) {
      const match = value.match(/\/auth\/([^/?#]+)/)
      if (!match) {
        setError('Invalid login link.')
        return
      }
      const token = match[1]

      setLoading(true)

      try {
        const res = await fetch(`/api/auth/claim/${encodeURIComponent(token)}`)
        if (!res.ok) {
          const body = await res.text()
          throw new Error(body || `HTTP ${res.status}`)
        }
        const data: any = await res.json()
        const key = data.api_key || data.key || data.apiKey
        if (!key) throw new Error('No key returned')

        localStorage.setItem('meet-ai-key', key)

        const roomId = data.room_id || data.roomId
        if (roomId) {
          window.location.href = `/chat/${roomId}`
        } else {
          onConnect(key)
        }
      } catch (error: any) {
        setLoading(false)
        setError(`Failed to claim link: ${error.message}`)
      }
    } else if (value.startsWith('mai_')) {
      onConnect(value)
    } else {
      setError('Invalid key or link. Keys start with mai_ and links contain /auth/.')
    }
  }, [onConnect])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        connectWithKey()
      }
    },
    [connectWithKey],
  )

  return (
    <>
      <KeyHeadline text="Connect your key." />
      <p className="stagger-in mt-2 text-center text-base leading-relaxed text-text-secondary">
        Paste your API key or login link below.
      </p>
      <div className="stagger-in flex flex-col items-center gap-4">
        <div className="flex w-full max-w-md flex-col gap-3">
          <div className="relative flex items-center gap-2 max-[520px]:flex-col">
            <input
              ref={inputRef}
              type="text"
              placeholder="Paste your API key (mai_...) or login link"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              onKeyDown={handleKeyDown}
              disabled={loading}
              className="flex-1 rounded-lg border border-edge-light border-l-[3px] border-l-blue-600 bg-edge px-3.5 py-3 font-mono text-base text-text-primary outline-none transition-[border-color] duration-150 focus:border-edge-hover focus:border-l-blue-600 max-[520px]:w-full"
            />
            <button
              type="button"
              className="cursor-pointer whitespace-nowrap rounded-lg border border-edge-light bg-edge px-4 py-3 text-sm text-text-primary transition-[background,transform,border-color] duration-150 hover:border-edge-hover hover:bg-edge-dim max-[520px]:w-full"
              onClick={connectWithKey}
              disabled={loading}>
              {loading ? '...' : 'Connect'}
            </button>
          </div>
          {error && <div className="text-center text-sm text-red-400">{error}</div>}
        </div>
        <button
          type="button"
          className="cursor-pointer border-0 bg-transparent text-sm text-text-muted underline underline-offset-[3px] transition-colors duration-150 hover:text-text-secondary"
          onClick={onBack}>
          ← Back
        </button>
      </div>
    </>
  )
}
