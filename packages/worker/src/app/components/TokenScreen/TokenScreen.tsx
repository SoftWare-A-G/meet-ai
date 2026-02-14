import { Separator } from '@base-ui/react/separator'
import { useState, useCallback } from 'react'
import * as api from '../../lib/api'

type TokenScreenProps = {
  token: string
  onLogin: (key: string) => void
}

export default function TokenScreen({ token, onLogin }: TokenScreenProps) {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const isStandalone =
    (window.navigator as any).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isAndroid = /Android/.test(navigator.userAgent)

  const handleConnect = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api.claimToken(token)
      onLogin(data.api_key)
    } catch (error: any) {
      setError(error.message || 'Connection error. Try again.')
      setLoading(false)
    }
  }, [token, onLogin])

  const buttonText = loading ? 'Connecting...' : isStandalone ? 'Connect' : 'Connect in browser'

  let steps = null
  if (!isStandalone) {
    if (isIOS) {
      steps = (
        <div className="flex flex-col gap-3 text-left">
          <div className="flex gap-3 items-start text-sm text-[#C9D1D9]">
            <div className="w-6 h-6 rounded-full bg-primary text-primary-text flex items-center justify-center text-xs font-bold shrink-0">1</div>
            <div className="flex-1 leading-relaxed">
              Tap the <strong>Share</strong> button at the bottom of Safari
            </div>
          </div>
          <div className="flex gap-3 items-start text-sm text-[#C9D1D9]">
            <div className="w-6 h-6 rounded-full bg-primary text-primary-text flex items-center justify-center text-xs font-bold shrink-0">2</div>
            <div className="flex-1 leading-relaxed">
              Scroll down and tap <strong>Add to Home Screen</strong>
            </div>
          </div>
          <div className="flex gap-3 items-start text-sm text-[#C9D1D9]">
            <div className="w-6 h-6 rounded-full bg-primary text-primary-text flex items-center justify-center text-xs font-bold shrink-0">3</div>
            <div className="flex-1 leading-relaxed">
              Tap <strong>Add</strong> in the top right corner
            </div>
          </div>
          <div className="flex gap-3 items-start text-sm text-[#C9D1D9]">
            <div className="w-6 h-6 rounded-full bg-primary text-primary-text flex items-center justify-center text-xs font-bold shrink-0">4</div>
            <div className="flex-1 leading-relaxed">
              Open the app from your Home Screen and tap <strong>Connect</strong>
            </div>
          </div>
        </div>
      )
    } else if (isAndroid) {
      steps = (
        <div className="flex flex-col gap-3 text-left">
          <div className="flex gap-3 items-start text-sm text-[#C9D1D9]">
            <div className="w-6 h-6 rounded-full bg-primary text-primary-text flex items-center justify-center text-xs font-bold shrink-0">1</div>
            <div className="flex-1 leading-relaxed">
              Tap the <strong>menu</strong> button &#8942; in Chrome
            </div>
          </div>
          <div className="flex gap-3 items-start text-sm text-[#C9D1D9]">
            <div className="w-6 h-6 rounded-full bg-primary text-primary-text flex items-center justify-center text-xs font-bold shrink-0">2</div>
            <div className="flex-1 leading-relaxed">
              Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>
            </div>
          </div>
          <div className="flex gap-3 items-start text-sm text-[#C9D1D9]">
            <div className="w-6 h-6 rounded-full bg-primary text-primary-text flex items-center justify-center text-xs font-bold shrink-0">3</div>
            <div className="flex-1 leading-relaxed">
              Open the app from your Home Screen and tap <strong>Connect</strong>
            </div>
          </div>
        </div>
      )
    } else {
      steps = (
        <div className="flex flex-col gap-3 text-left">
          <div className="flex gap-3 items-start text-sm text-[#C9D1D9]">
            <div className="w-6 h-6 rounded-full bg-primary text-primary-text flex items-center justify-center text-xs font-bold shrink-0">1</div>
            <div className="flex-1 leading-relaxed">Install the app using your browser's install option</div>
          </div>
          <div className="flex gap-3 items-start text-sm text-[#C9D1D9]">
            <div className="w-6 h-6 rounded-full bg-primary text-primary-text flex items-center justify-center text-xs font-bold shrink-0">2</div>
            <div className="flex-1 leading-relaxed">
              Open the app and tap <strong>Connect</strong>
            </div>
          </div>
        </div>
      )
    }
  }

  return (
    <div className="flex-1 flex flex-col bg-chat-bg text-msg-text min-w-0 h-dvh">
      <div className="flex-1 flex items-center justify-center flex-col gap-5 p-6">
        <h2 className="text-[22px] font-bold text-[#C9D1D9] text-center">{isStandalone ? 'Connect to chat' : 'Install meet-ai'}</h2>
        <p className="text-sm text-[#8B949E] text-center max-w-[400px] leading-relaxed">
          {isStandalone
            ? 'Tap the button below to activate your session.'
            : 'Add meet-ai to your Home Screen for the best experience.'}
        </p>

        {isStandalone ? (
          <div className="w-full max-w-[400px] bg-[#161B22] border border-[#30363D] rounded-xl p-6 flex flex-col gap-4">
            <button type="button" className="w-full py-3.5 border-none rounded-lg bg-primary text-primary-text text-base font-semibold cursor-pointer transition-[filter] duration-150 hover:brightness-110 disabled:opacity-60 disabled:cursor-wait" onClick={handleConnect} disabled={loading}>
              {buttonText}
            </button>
            <div className="text-[#F85149] text-[13px] text-center min-h-[18px]">{error}</div>
          </div>
        ) : (
          <>
            {steps && <div className="w-full max-w-[400px] bg-[#161B22] border border-[#30363D] rounded-xl p-6 flex flex-col gap-4">{steps}</div>}
            <Separator className="w-full border-t border-[#30363D] my-1" />
            <p className="text-[13px] text-[#8B949E] text-center">Or connect directly in this browser:</p>
            <div className="w-full max-w-[400px] bg-[#161B22] border border-[#30363D] rounded-xl p-6 flex flex-col gap-4">
              <button type="button" className="w-full py-3.5 border-none rounded-lg bg-primary text-primary-text text-base font-semibold cursor-pointer transition-[filter] duration-150 hover:brightness-110 disabled:opacity-60 disabled:cursor-wait" onClick={handleConnect} disabled={loading}>
                {buttonText}
              </button>
              <div className="text-[#F85149] text-[13px] text-center min-h-[18px]">{error}</div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
