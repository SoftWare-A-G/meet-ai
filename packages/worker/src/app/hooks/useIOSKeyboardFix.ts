import { useEffect } from 'react'
import type { RefObject } from 'react'

/**
 * On iOS PWA (standalone mode), the first keyboard open doesn't shift the
 * viewport up — the textarea gets hidden behind the on-screen keyboard.
 * This hook listens for visualViewport resize events and scrolls the focused
 * textarea into view.
 */
export function useIOSKeyboardFix(ref: RefObject<HTMLTextAreaElement | null>) {
  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Only apply on iOS-like touch devices
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    if (!isIOS) return

    const vv = window.visualViewport
    if (!vv) return

    function onResize() {
      // If our textarea is focused and keyboard just appeared, scroll it into view
      if (document.activeElement === ref.current) {
        // Small delay to let iOS finish layout
        requestAnimationFrame(() => {
          ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        })
      }
    }

    function onFocus() {
      // On first focus, iOS may not resize the viewport immediately.
      // Use a short delay to let the keyboard animation start, then scroll.
      setTimeout(() => {
        ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }, 100)
    }

    vv.addEventListener('resize', onResize)
    el.addEventListener('focus', onFocus)

    return () => {
      vv.removeEventListener('resize', onResize)
      el.removeEventListener('focus', onFocus)
    }
  }, [ref])
}
