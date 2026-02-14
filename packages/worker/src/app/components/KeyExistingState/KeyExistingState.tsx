import { Link } from '@tanstack/react-router'
import { AlertDialog } from '@base-ui/react/alert-dialog'
import KeyHeadline from '../KeyHeadline'

type KeyExistingStateProps = {
  apiKey: string
  onRegenerate: () => void
}

function getKeyPrefix(key: string): string {
  if (key.length >= 8) return `${key.substring(0, 8)}...`
  return key
}

export default function KeyExistingState({ apiKey, onRegenerate }: KeyExistingStateProps) {
  return (
    <>
      <KeyHeadline text="Welcome back." />
      <div className="flex flex-col items-center gap-4">
        <span className="stagger-in text-sm text-text-secondary">Your key is active:</span>
        <span className="stagger-in inline-block rounded-lg border border-edge-light bg-edge px-5 py-2.5 font-mono text-sm text-text-secondary">
          {getKeyPrefix(apiKey)}
        </span>
        <div className="stagger-in flex flex-wrap justify-center gap-3">
          <Link
            to="/chat"
            className="group inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border-0 bg-blue-600 px-8 py-3.5 text-base font-semibold text-white no-underline shadow-[0_0_60px_rgba(37,99,235,0.08)] transition-colors duration-150 hover:bg-blue-700 active:bg-blue-800 max-[520px]:w-full">
            Open Chat{' '}
            <span className="transition-transform duration-200 ease-out group-hover:translate-x-1 motion-reduce:transition-none">
              →
            </span>
          </Link>
          <AlertDialog.Root>
            <AlertDialog.Trigger className="inline-flex cursor-pointer items-center justify-center rounded-full border border-edge-light bg-edge px-6 py-3 text-sm font-medium text-text-primary no-underline transition-colors duration-150 hover:border-edge-hover hover:bg-edge-dim">
              Generate New Key
            </AlertDialog.Trigger>
            <AlertDialog.Portal>
              <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-black/50" />
              <AlertDialog.Popup className="fixed left-1/2 top-1/2 z-50 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3 rounded-xl border border-edge-light bg-edge p-5">
                <AlertDialog.Title className="text-center text-sm text-text-primary">
                  This will create a new key.
                </AlertDialog.Title>
                <AlertDialog.Description className="text-center text-sm text-text-primary">
                  Your current key will keep working.
                </AlertDialog.Description>
                <div className="flex gap-3">
                  <AlertDialog.Close className="cursor-pointer rounded-full border border-edge-light bg-transparent px-5 py-2 text-[13px] text-text-secondary transition-colors duration-150 hover:bg-edge-dim hover:text-text-primary">
                    Cancel
                  </AlertDialog.Close>
                  <button
                    type="button"
                    className="cursor-pointer rounded-full border border-[#5c2b2e] bg-transparent px-5 py-2 text-[13px] text-red-400 transition-colors duration-150 hover:bg-[#2a1215] hover:text-red-400"
                    onClick={onRegenerate}>
                    Generate
                  </button>
                </div>
              </AlertDialog.Popup>
            </AlertDialog.Portal>
          </AlertDialog.Root>
        </div>
        <span className="stagger-in text-center text-sm text-text-muted">
          Your key is saved in this browser.
        </span>
      </div>
    </>
  )
}
