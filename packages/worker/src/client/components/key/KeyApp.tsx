import { useState, useCallback, useEffect, useRef } from 'hono/jsx/dom'
import GenerateState from './GenerateState'
import PasteKeyState from './PasteKeyState'
import ExistingKeyState from './ExistingKeyState'
import ResultState from './ResultState'
import ErrorState from './ErrorState'

const STORAGE_KEY = 'meet-ai-key'

type KeyState =
  | { view: 'generate' }
  | { view: 'paste' }
  | { view: 'loading' }
  | { view: 'existing'; key: string }
  | { view: 'result'; key: string }
  | { view: 'error'; message: string }

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

function staggerReveal(container: HTMLElement) {
  const els = container.querySelectorAll('.stagger-in')
  if (prefersReducedMotion) {
    els.forEach((el) => el.classList.add('visible'))
    return
  }
  els.forEach((el, i) => {
    setTimeout(() => el.classList.add('visible'), 100 + i * 150)
  })
}

export default function KeyApp() {
  const [state, setState] = useState<KeyState>({ view: 'generate' })
  const contentRef = useRef<HTMLDivElement>(null)
  const pendingStateRef = useRef<KeyState | null>(null)

  // Stagger reveal after each state render
  useEffect(() => {
    if (contentRef.current) {
      staggerReveal(contentRef.current)
    }
  }, [state])

  // Keep header CTA in sync with current state
  useEffect(() => {
    const headerCta = document.getElementById('header-cta') as HTMLAnchorElement | null
    if (!headerCta) return
    const hasKey = state.view === 'existing' || state.view === 'result'
    headerCta.href = hasKey ? '/chat' : '/key'
    headerCta.textContent = hasKey ? 'Open Chat' : 'Get API Key'
  }, [state])

  // On mount: check for existing key
  useEffect(() => {
    const existingKey = localStorage.getItem(STORAGE_KEY)
    if (!existingKey) return

    fetch('/api/rooms', {
      headers: { Authorization: 'Bearer ' + existingKey },
    })
      .then((res) => {
        if (res.status === 401) {
          localStorage.removeItem(STORAGE_KEY)
          transitionTo({ view: 'generate' })
        } else {
          transitionTo({ view: 'existing', key: existingKey })
        }
      })
      .catch(() => {
        // Network error — assume key is valid
        transitionTo({ view: 'existing', key: existingKey })
      })
  }, [])

  const transitionTo = useCallback((nextState: KeyState) => {
    if (prefersReducedMotion) {
      setState(nextState)
      return
    }
    const el = contentRef.current
    if (!el) {
      setState(nextState)
      return
    }
    el.classList.add('fade-out')
    pendingStateRef.current = nextState
    setTimeout(() => {
      el.classList.remove('fade-out')
      setState(pendingStateRef.current!)
      pendingStateRef.current = null
      el.classList.add('fade-in')
      const handler = () => {
        el.classList.remove('fade-in')
        el.removeEventListener('animationend', handler)
      }
      el.addEventListener('animationend', handler)
    }, 200)
  }, [])

  const handleGenerate = useCallback(async () => {
    transitionTo({ view: 'loading' })

    try {
      const res = await fetch('/api/keys', { method: 'POST' })
      if (!res.ok) {
        const body = await res.text()
        throw new Error(body || 'HTTP ' + res.status)
      }
      const data: any = await res.json()
      const key = data.key || data.apiKey || data.token
      if (!key) throw new Error('No key returned from server')

      localStorage.setItem(STORAGE_KEY, key)
      transitionTo({ view: 'result', key })
    } catch (err: any) {
      transitionTo({ view: 'error', message: 'Failed to generate key: ' + err.message })
    }
  }, [transitionTo])

  const handlePaste = useCallback(() => {
    transitionTo({ view: 'paste' })
  }, [transitionTo])

  const handleBackToGenerate = useCallback(() => {
    transitionTo({ view: 'generate' })
  }, [transitionTo])

  const handleConnect = useCallback(
    (key: string) => {
      localStorage.setItem(STORAGE_KEY, key)
      transitionTo({ view: 'existing', key })
    },
    [transitionTo],
  )

  const handleRegenerate = useCallback(() => {
    handleGenerate()
  }, [handleGenerate])

  const handleRetry = useCallback(() => {
    handleGenerate()
  }, [handleGenerate])

  const renderState = () => {
    switch (state.view) {
      case 'generate':
        return <GenerateState onGenerate={handleGenerate} onPaste={handlePaste} />
      case 'paste':
        return <PasteKeyState onConnect={handleConnect} onBack={handleBackToGenerate} />
      case 'loading':
        return (
          <>
            <h1 class="headline font-mono font-extrabold tracking-tight leading-tight text-center">
              Your key to the conversation.
            </h1>
            <div class="flex flex-col items-center gap-4">
              <button
                class="group inline-flex items-center justify-center gap-2 py-3.5 px-8 border-0 rounded-full bg-blue-600 text-white cursor-pointer text-base font-semibold no-underline transition-colors duration-150 shadow-[0_0_60px_rgba(37,99,235,0.08)] max-[520px]:w-full"
                disabled
                style={{ opacity: '0.6', cursor: 'wait' }}
              >
                <span class="spinner" /> Generating...
              </button>
            </div>
          </>
        )
      case 'existing':
        return <ExistingKeyState apiKey={state.key} onRegenerate={handleRegenerate} />
      case 'result':
        return <ResultState apiKey={state.key} />
      case 'error':
        return <ErrorState message={state.message} onRetry={handleRetry} />
    }
  }

  return (
    <div ref={contentRef} class="flex flex-col gap-6">
      {renderState()}
    </div>
  )
}
