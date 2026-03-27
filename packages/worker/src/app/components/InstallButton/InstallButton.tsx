import { useState, useEffect, useCallback } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// Capture the event at module level so it survives component unmount/remount
// and is available even if the event fires before the component mounts.
let savedPrompt: BeforeInstallPromptEvent | null = null
window.addEventListener('beforeinstallprompt', (e: Event) => {
  e.preventDefault()
  savedPrompt = e as BeforeInstallPromptEvent
})

type InstallButtonProps = {
  onIOSInstall: () => void
}

export default function InstallButton({ onIOSInstall }: InstallButtonProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(savedPrompt)
  const [isIOS, setIsIOS] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Already running as PWA — hide entirely
    const isStandalone = navigator.standalone === true
      || window.matchMedia('(display-mode: standalone)').matches
    if (isStandalone) return

    // iOS detection
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
    if (ios) {
      setIsIOS(true)
      setVisible(true)
      return
    }

    // If we already captured the event before mount, show the button
    if (savedPrompt) {
      setDeferredPrompt(savedPrompt)
      setVisible(true)
    }

    // Listen for future beforeinstallprompt events
    const handler = (e: Event) => {
      e.preventDefault()
      savedPrompt = e as BeforeInstallPromptEvent
      setDeferredPrompt(savedPrompt)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', handler)

    const installedHandler = () => {
      setVisible(false)
      setDeferredPrompt(null)
      savedPrompt = null
    }
    window.addEventListener('appinstalled', installedHandler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  const handleClick = useCallback(async () => {
    if (isIOS) {
      onIOSInstall()
      return
    }
    if (deferredPrompt) {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      setVisible(false)
      setDeferredPrompt(null)
      savedPrompt = null
      if (outcome === 'accepted') {
        // App installed successfully
      }
    }
  }, [isIOS, deferredPrompt, onIOSInstall])

  if (!visible) return null

  return (
    <button type="button" className="bg-transparent border border-white/15 text-sidebar-text cursor-pointer flex items-center gap-1 px-2 py-[3px] rounded text-[11px] font-semibold whitespace-nowrap opacity-70 transition-[opacity,background] duration-150 hover:opacity-100 hover:bg-hover-item" title="Install app" onClick={handleClick}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      Install
    </button>
  )
}
