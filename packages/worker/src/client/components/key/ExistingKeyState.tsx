import { useState, useCallback } from 'hono/jsx/dom'
import Headline from './Headline'

type ExistingKeyStateProps = {
  apiKey: string
  onRegenerate: () => void
}

function getKeyPrefix(key: string): string {
  if (key.length >= 8) return key.substring(0, 8) + '...'
  return key
}

export default function ExistingKeyState({ apiKey, onRegenerate }: ExistingKeyStateProps) {
  const [showConfirm, setShowConfirm] = useState(false)

  const handleCancel = useCallback(() => {
    setShowConfirm(false)
  }, [])

  const handleShowConfirm = useCallback(() => {
    setShowConfirm(true)
  }, [])

  return (
    <>
      <Headline text="Welcome back." />
      <div class="existing-key flex flex-col gap-4 items-center">
        <span class="text-sm text-text-secondary stagger-in">Your key is active:</span>
        <span class="font-mono text-sm text-text-secondary bg-edge border border-edge-light rounded-lg px-5 py-2.5 inline-block stagger-in">
          {getKeyPrefix(apiKey)}
        </span>
        {!showConfirm && (
          <>
            <div class="actions flex gap-3 justify-center flex-wrap stagger-in">
              <a
                href="/chat"
                class="group inline-flex items-center justify-center gap-2 py-3.5 px-8 border-0 rounded-full bg-blue-600 text-white cursor-pointer text-base font-semibold no-underline transition-colors duration-150 shadow-[0_0_60px_rgba(37,99,235,0.08)] hover:bg-blue-700 active:bg-blue-800 max-[520px]:w-full"
              >
                Open Chat{' '}
                <span class="transition-transform duration-200 ease-out group-hover:translate-x-1 motion-reduce:transition-none">
                  →
                </span>
              </a>
              <button
                class="inline-flex items-center justify-center py-3 px-6 border border-edge-light rounded-full bg-edge text-text-primary cursor-pointer text-sm font-medium no-underline transition-colors duration-150 hover:bg-edge-dim hover:border-edge-hover"
                onClick={handleShowConfirm}
              >
                Generate New Key
              </button>
            </div>
            <span class="actions-helper text-sm text-text-muted text-center stagger-in">
              Your key is saved in this browser.
            </span>
          </>
        )}
        {showConfirm && (
          <div class="flex flex-col gap-3 items-center p-5 bg-edge border border-edge-light rounded-xl fade-in">
            <p class="text-sm text-text-primary text-center">
              This will create a new key.
              <br />
              Your current key will keep working.
            </p>
            <div class="flex gap-3">
              <button
                class="py-2 px-5 border border-edge-light rounded-full bg-transparent text-text-secondary cursor-pointer text-[13px] transition-colors duration-150 hover:bg-edge-dim hover:text-text-primary"
                onClick={handleCancel}
              >
                Cancel
              </button>
              <button
                class="py-2 px-5 border border-[#5c2b2e] rounded-full bg-transparent text-red-400 cursor-pointer text-[13px] transition-colors duration-150 hover:bg-[#2a1215] hover:text-red-400"
                onClick={onRegenerate}
              >
                Generate
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
