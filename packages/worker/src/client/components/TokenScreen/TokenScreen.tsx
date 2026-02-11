import { useState, useCallback } from 'hono/jsx/dom'
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
    } catch (e: any) {
      setError(e.message || 'Connection error. Try again.')
      setLoading(false)
    }
  }, [token, onLogin])

  const buttonText = loading ? 'Connecting...' : isStandalone ? 'Connect' : 'Connect in browser'

  let steps = null
  if (!isStandalone) {
    if (isIOS) {
      steps = (
        <div class="install-steps">
          <div class="install-step">
            <div class="step-num">1</div>
            <div class="step-text">
              Tap the <strong>Share</strong> button at the bottom of Safari
            </div>
          </div>
          <div class="install-step">
            <div class="step-num">2</div>
            <div class="step-text">
              Scroll down and tap <strong>Add to Home Screen</strong>
            </div>
          </div>
          <div class="install-step">
            <div class="step-num">3</div>
            <div class="step-text">
              Tap <strong>Add</strong> in the top right corner
            </div>
          </div>
          <div class="install-step">
            <div class="step-num">4</div>
            <div class="step-text">
              Open the app from your Home Screen and tap <strong>Connect</strong>
            </div>
          </div>
        </div>
      )
    } else if (isAndroid) {
      steps = (
        <div class="install-steps">
          <div class="install-step">
            <div class="step-num">1</div>
            <div class="step-text">
              Tap the <strong>menu</strong> button &#8942; in Chrome
            </div>
          </div>
          <div class="install-step">
            <div class="step-num">2</div>
            <div class="step-text">
              Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>
            </div>
          </div>
          <div class="install-step">
            <div class="step-num">3</div>
            <div class="step-text">
              Open the app from your Home Screen and tap <strong>Connect</strong>
            </div>
          </div>
        </div>
      )
    } else {
      steps = (
        <div class="install-steps">
          <div class="install-step">
            <div class="step-num">1</div>
            <div class="step-text">Install the app using your browser's install option</div>
          </div>
          <div class="install-step">
            <div class="step-num">2</div>
            <div class="step-text">
              Open the app and tap <strong>Connect</strong>
            </div>
          </div>
        </div>
      )
    }
  }

  return (
    <div class="main" style="height:100dvh">
      <div class="token-screen">
        <h2>{isStandalone ? 'Connect to chat' : 'Install meet-ai'}</h2>
        <p>
          {isStandalone
            ? 'Tap the button below to activate your session.'
            : 'Add meet-ai to your Home Screen for the best experience.'}
        </p>

        {isStandalone ? (
          <div class="token-card">
            <button type="button" class="connect-btn" onClick={handleConnect} disabled={loading}>
              {buttonText}
            </button>
            <div class="connect-error">{error}</div>
          </div>
        ) : (
          <>
            {steps && <div class="token-card">{steps}</div>}
            <div class="separator" />
            <p class="alt-text">Or connect directly in this browser:</p>
            <div class="token-card">
              <button type="button" class="connect-btn" onClick={handleConnect} disabled={loading}>
                {buttonText}
              </button>
              <div class="connect-error">{error}</div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
