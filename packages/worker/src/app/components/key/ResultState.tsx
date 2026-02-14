import { useEffect, useRef, useCallback } from 'react'
import SettingsPanel from './SettingsPanel'
import QuickStartSteps from './QuickStartSteps'

function copyText(text: string, btnEl: HTMLElement, label = 'Copy') {
  navigator.clipboard.writeText(text).then(() => {
    btnEl.textContent = '\u2713'
    btnEl.classList.add('copied')
    setTimeout(() => {
      btnEl.textContent = label
      btnEl.classList.remove('copied')
    }, 2000)
  })
}

export default function ResultState({ apiKey }: { apiKey: string }) {
  const copyBtnRef = useRef<HTMLButtonElement>(null)

  const handleCopy = useCallback(() => {
    if (copyBtnRef.current) {
      copyText(apiKey, copyBtnRef.current)
    }
  }, [apiKey])

  useEffect(() => {
    const t = setTimeout(() => {
      document.querySelector('.shimmer')?.classList.remove('shimmer')
    }, 900)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="flex flex-col gap-5 text-left">
      <div className="flex items-center gap-2 text-sm text-text-secondary stagger-in">
        <span className="size-2 rounded-full bg-green-500 shrink-0" /> Your key is ready
      </div>

      <div className="shimmer flex gap-2 items-center relative max-[520px]:flex-col stagger-in">
        <input
          type="text"
          value={apiKey}
          readOnly
          className="flex-1 py-3 px-3.5 border border-edge-light border-l-[3px] border-l-blue-600 rounded-lg bg-edge text-text-primary font-mono text-sm outline-none transition-[border-color] duration-150 focus:border-edge-hover focus:border-l-blue-600 max-[520px]:w-full"
        />
        <button
          className="py-3 px-4 border border-edge-light rounded-lg bg-edge text-text-primary cursor-pointer text-sm whitespace-nowrap transition-[background,transform,border-color] duration-150 hover:bg-edge-dim hover:border-edge-hover max-[520px]:w-full"
          ref={copyBtnRef}
          onClick={handleCopy}
        >
          Copy
        </button>
      </div>

      <p className="text-sm text-text-secondary mt-2 stagger-in">
        Save this now — you won't see it again.
      </p>

      <div className="stagger-in">
        <SettingsPanel apiKey={apiKey} />
      </div>

      <div className="stagger-in">
        <h3 className="text-sm font-semibold mb-5 text-text-primary">Quick Start</h3>
        <QuickStartSteps />
      </div>

      <div className="flex gap-3 justify-center flex-wrap stagger-in">
        <a
          href="/chat"
          className="group inline-flex items-center justify-center gap-2 py-3.5 px-8 border-0 rounded-full bg-blue-600 text-white cursor-pointer text-base font-semibold no-underline transition-colors duration-150 shadow-[0_0_60px_rgba(37,99,235,0.08)] hover:bg-blue-700 active:bg-blue-800 max-[520px]:w-full"
        >
          Start chatting{' '}
          <span className="transition-transform duration-200 ease-out group-hover:translate-x-1 motion-reduce:transition-none">
            →
          </span>
        </a>
      </div>

      <p className="text-sm text-text-muted text-center stagger-in">
        Your key is saved in this browser. You're good to go.
      </p>
    </div>
  )
}
