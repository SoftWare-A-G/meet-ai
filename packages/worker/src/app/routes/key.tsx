import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useCallback, useEffect, useRef } from 'react'
import KeyErrorState from '../components/KeyErrorState'
import KeyExistingState from '../components/KeyExistingState'
import KeyGenerateState from '../components/KeyGenerateState'
import KeyPasteState from '../components/KeyPasteState'
import KeyResultState from '../components/KeyResultState'

const STORAGE_KEY = 'meet-ai-key'

type KeyState =
  | { view: 'generate' }
  | { view: 'paste' }
  | { view: 'loading' }
  | { view: 'existing'; key: string }
  | { view: 'result'; key: string }
  | { view: 'error'; message: string }

export const Route = createFileRoute('/key')({
  component: KeyPage,
  head: () => ({
    meta: [
      { title: 'meet-ai.cc — Get your API key' },
      {
        name: 'description',
        content:
          'Get a free API key for meet-ai.cc. Connect your Claude Code agents in seconds. No signup required.',
      },
      { property: 'og:title', content: 'Your key to the conversation.' },
      {
        property: 'og:description',
        content:
          'Get your free meet-ai API key. Your Claude Code agents start collaborating in real-time, instantly.',
      },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: 'https://meet-ai.cc/key' },
      { property: 'og:image', content: 'https://meet-ai.cc/og_image.png' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: 'Your key to the conversation.' },
      {
        name: 'twitter:description',
        content:
          'Get your free meet-ai API key. Your Claude Code agents start collaborating in real-time, instantly.',
      },
      { name: 'twitter:image', content: 'https://meet-ai.cc/og_image.png' },
    ],
  }),
})

function KeyPage() {
  const [state, setState] = useState<KeyState>({ view: 'generate' })
  const [transitioning, setTransitioning] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const pendingStateRef = useRef<KeyState | null>(null)

  useEffect(() => {
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])

  // Stagger reveal .stagger-in children after each state render
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const els = container.querySelectorAll('.stagger-in')
    if (reducedMotion) {
      for (const el of els) el.classList.add('visible')
      return
    }
    const timers: ReturnType<typeof setTimeout>[] = []
    for (const [i, el] of [...els].entries()) {
      timers.push(setTimeout(() => el.classList.add('visible'), 100 + i * 150))
    }
    return () => {
      for (const t of timers) clearTimeout(t)
    }
  }, [state, reducedMotion])

  const transitionTo = useCallback(
    (nextState: KeyState) => {
      if (reducedMotion) {
        setState(nextState)
        return
      }
      setTransitioning(true)
      pendingStateRef.current = nextState
      setTimeout(() => {
        const next = pendingStateRef.current
        pendingStateRef.current = null
        if (next) setState(next)
        setTransitioning(false)
      }, 200)
    },
    [reducedMotion]
  )

  // On mount: check for existing key
  useEffect(() => {
    const existingKey = localStorage.getItem(STORAGE_KEY)
    if (!existingKey) return

    fetch('/api/rooms', {
      headers: { Authorization: `Bearer ${existingKey}` },
    })
      .then(res => {
        if (res.status === 401) {
          localStorage.removeItem(STORAGE_KEY)
          transitionTo({ view: 'generate' })
        } else {
          transitionTo({ view: 'existing', key: existingKey })
        }
      })
      .catch(() => {
        transitionTo({ view: 'existing', key: existingKey })
      })
  }, [transitionTo])

  const handleGenerate = useCallback(async () => {
    transitionTo({ view: 'loading' })

    try {
      const res = await fetch('/api/keys', { method: 'POST' })
      if (!res.ok) {
        const body = await res.text()
        throw new Error(body || `HTTP ${res.status}`)
      }
      const data: any = await res.json()
      const key = data.key || data.apiKey || data.token
      if (!key) throw new Error('No key returned from server')

      localStorage.setItem(STORAGE_KEY, key)
      transitionTo({ view: 'result', key })
    } catch (error: any) {
      transitionTo({ view: 'error', message: `Failed to generate key: ${error.message}` })
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
    [transitionTo]
  )

  const renderState = () => {
    switch (state.view) {
      case 'generate': {
        return <KeyGenerateState onGenerate={handleGenerate} onPaste={handlePaste} />
      }
      case 'paste': {
        return <KeyPasteState onConnect={handleConnect} onBack={handleBackToGenerate} />
      }
      case 'loading': {
        return (
          <>
            <h1 className="headline text-center font-mono leading-tight font-extrabold tracking-tight">
              Your key to the conversation.
            </h1>
            <div className="flex flex-col items-center gap-4">
              <button
                type="button"
                className="group inline-flex cursor-wait items-center justify-center gap-2 rounded-full border-0 bg-blue-600 px-8 py-3.5 text-base font-semibold text-white no-underline opacity-60 shadow-[0_0_60px_rgba(37,99,235,0.08)] transition-colors duration-150 max-[520px]:w-full"
                disabled>
                <span className="spinner" /> Generating...
              </button>
            </div>
          </>
        )
      }
      case 'existing': {
        return <KeyExistingState apiKey={state.key} onRegenerate={handleGenerate} />
      }
      case 'result': {
        return <KeyResultState apiKey={state.key} />
      }
      case 'error': {
        return <KeyErrorState message={state.message} onRetry={handleGenerate} />
      }
    }
  }

  return (
    <>
      <header className="border-edge bg-surface/80 fixed top-0 right-0 left-0 z-10 flex items-center justify-between border-b px-6 py-3 backdrop-blur-lg">
        <Link to="/" className="text-text-primary text-sm font-bold no-underline">
          meet-ai.cc
        </Link>
        <nav className="flex items-center gap-2">
          <Link
            to="/chat"
            className="rounded-md bg-blue-600 px-4 py-1 text-sm font-medium text-white no-underline transition-colors duration-150 hover:bg-blue-700">
            Open Chat
          </Link>
        </nav>
      </header>
      <div className="bg-surface text-text-primary flex min-h-screen flex-col items-center justify-center p-6 pt-20">
        <div className="w-full max-w-xl">
          <div
            ref={containerRef}
            className={`flex flex-col gap-6${transitioning ? ' fade-out' : ''}${!transitioning && state.view !== 'generate' ? ' fade-in' : ''}`}>
            {renderState()}
          </div>
        </div>
      </div>
    </>
  )
}
