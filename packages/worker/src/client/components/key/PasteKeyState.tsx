import { useState, useCallback, useRef, useEffect } from 'hono/jsx/dom'
import Headline from './Headline'

type PasteKeyStateProps = {
  onConnect: (key: string) => void
  onBack: () => void
}

export default function PasteKeyState({ onConnect, onBack }: PasteKeyStateProps) {
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
        const res = await fetch('/api/auth/claim/' + encodeURIComponent(token))
        if (!res.ok) {
          const body = await res.text()
          throw new Error(body || 'HTTP ' + res.status)
        }
        const data: any = await res.json()
        const key = data.api_key || data.key || data.apiKey
        if (!key) throw new Error('No key returned')

        localStorage.setItem('meet-ai-key', key)

        const roomId = data.room_id || data.roomId
        if (roomId) {
          window.location.href = '/chat/' + roomId
        } else {
          onConnect(key)
        }
      } catch (err: any) {
        setLoading(false)
        setError('Failed to claim link: ' + err.message)
      }
    } else if (value.startsWith('mai_')) {
      onConnect(value)
    } else {
      setError('Invalid key or link. Keys start with mai_ and links contain /auth/.')
    }
  }, [onConnect])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        connectWithKey()
      }
    },
    [connectWithKey],
  )

  return (
    <>
      <Headline text="Connect your key." />
      <p class="text-base text-text-secondary text-center mt-2 leading-relaxed stagger-in">
        Paste your API key or login link below.
      </p>
      <div class="flex flex-col items-center gap-4 stagger-in">
        <div class="flex flex-col gap-3 w-full max-w-md">
          <div class="flex gap-2 items-center relative max-[520px]:flex-col">
            <input
              ref={inputRef}
              type="text"
              placeholder="Paste your API key (mai_...) or login link"
              autocomplete="off"
              autocapitalize="off"
              spellcheck={false}
              onKeyDown={handleKeyDown}
              disabled={loading}
              class="flex-1 py-3 px-3.5 border border-edge-light border-l-[3px] border-l-blue-600 rounded-lg bg-edge text-text-primary font-mono text-base outline-none transition-[border-color] duration-150 focus:border-edge-hover focus:border-l-blue-600 max-[520px]:w-full"
            />
            <button
              class="py-3 px-4 border border-edge-light rounded-lg bg-edge text-text-primary cursor-pointer text-sm whitespace-nowrap transition-[background,transform,border-color] duration-150 hover:bg-edge-dim hover:border-edge-hover max-[520px]:w-full"
              onClick={connectWithKey}
              disabled={loading}
            >
              {loading ? '...' : 'Connect'}
            </button>
          </div>
          {error && (
            <div class="text-sm text-red-400 text-center">{error}</div>
          )}
        </div>
        <button
          class="text-sm text-text-muted bg-transparent border-0 cursor-pointer underline underline-offset-[3px] transition-colors duration-150 hover:text-text-secondary"
          onClick={onBack}
        >
          ← Back
        </button>
      </div>
    </>
  )
}
