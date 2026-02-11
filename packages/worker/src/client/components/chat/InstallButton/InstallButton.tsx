import { useState, useEffect, useCallback } from 'hono/jsx/dom'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isIOS, setIsIOS] = useState(false)
  const [showIOSModal, setShowIOSModal] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Already running as PWA — hide entirely
    const isStandalone = (window.navigator as any).standalone === true
      || window.matchMedia('(display-mode: standalone)').matches
    if (isStandalone) return

    // iOS detection
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
    if (ios) {
      setIsIOS(true)
      setVisible(true)
      return
    }

    // Android/Chrome: listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', handler)

    const installedHandler = () => {
      setVisible(false)
      setDeferredPrompt(null)
    }
    window.addEventListener('appinstalled', installedHandler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  const handleClick = useCallback(async () => {
    if (isIOS) {
      setShowIOSModal(true)
      return
    }
    if (deferredPrompt) {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setVisible(false)
      }
      setDeferredPrompt(null)
    }
  }, [isIOS, deferredPrompt])

  if (!visible) return null

  return (
    <>
      <button class="install-btn" title="Install app" onClick={handleClick}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        Install
      </button>

      {showIOSModal && (
        <div class="ios-install-overlay" onClick={() => setShowIOSModal(false)}>
          <div class="ios-install-panel" onClick={(e: Event) => e.stopPropagation()}>
            <h3>Install meet-ai</h3>
            <div class="ios-install-steps">
              <div class="ios-install-step">
                <span class="ios-step-num">1</span>
                <span class="ios-step-text">
                  Tap the <strong>Share</strong> button
                  <svg class="ios-share-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" /></svg>
                  in the toolbar
                </span>
              </div>
              <div class="ios-install-step">
                <span class="ios-step-num">2</span>
                <span class="ios-step-text">Scroll down and tap <strong>Add to Home Screen</strong></span>
              </div>
              <div class="ios-install-step">
                <span class="ios-step-num">3</span>
                <span class="ios-step-text">Tap <strong>Add</strong> in the top right</span>
              </div>
            </div>
            <button class="ios-install-close" onClick={() => setShowIOSModal(false)}>Got it</button>
          </div>
        </div>
      )}
    </>
  )
}
