import { useState, useEffect, useCallback } from 'react'
import { Link } from '@tanstack/react-router'
import KeySettingsPanel from '../KeySettingsPanel'
import KeyQuickStartSteps from '../KeyQuickStartSteps'

export default function KeyResultState({ apiKey }: { apiKey: string }) {
  const [copied, setCopied] = useState(false)
  const [shimmer, setShimmer] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setShimmer(false), 900)
    return () => clearTimeout(t)
  }, [])

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(apiKey).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [apiKey])

  return (
    <div className="flex flex-col gap-5 text-left">
      <div className="stagger-in flex items-center gap-2 text-sm text-text-secondary">
        <span className="size-2 shrink-0 rounded-full bg-green-500" /> Your key is ready
      </div>

      <div
        className={`stagger-in relative flex items-center gap-2 max-[520px]:flex-col${shimmer ? ' shimmer' : ''}`}>
        <input
          type="text"
          value={apiKey}
          readOnly
          className="flex-1 rounded-lg border border-edge-light border-l-[3px] border-l-blue-600 bg-edge px-3.5 py-3 font-mono text-sm text-text-primary outline-none transition-[border-color] duration-150 focus:border-edge-hover focus:border-l-blue-600 max-[520px]:w-full"
        />
        <button
          type="button"
          className={`cursor-pointer whitespace-nowrap rounded-lg border border-edge-light bg-edge px-4 py-3 text-sm text-text-primary transition-[background,transform,border-color] duration-150 hover:border-edge-hover hover:bg-edge-dim max-[520px]:w-full${copied ? ' copied' : ''}`}
          onClick={handleCopy}>
          {copied ? '\u2713' : 'Copy'}
        </button>
      </div>

      <p className="stagger-in mt-2 text-sm text-text-secondary">
        Save this now — you won't see it again.
      </p>

      <div className="stagger-in">
        <KeySettingsPanel apiKey={apiKey} />
      </div>

      <div className="stagger-in">
        <h3 className="mb-5 text-sm font-semibold text-text-primary">Quick Start</h3>
        <KeyQuickStartSteps />
      </div>

      <div className="stagger-in flex flex-wrap justify-center gap-3">
        <Link
          to="/chat"
          className="group inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border-0 bg-blue-600 px-8 py-3.5 text-base font-semibold text-white no-underline shadow-[0_0_60px_rgba(37,99,235,0.08)] transition-colors duration-150 hover:bg-blue-700 active:bg-blue-800 max-[520px]:w-full">
          Start chatting{' '}
          <span className="transition-transform duration-200 ease-out group-hover:translate-x-1 motion-reduce:transition-none">
            →
          </span>
        </Link>
      </div>

      <p className="stagger-in text-center text-sm text-text-muted">
        Your key is saved in this browser. You're good to go.
      </p>
    </div>
  )
}
