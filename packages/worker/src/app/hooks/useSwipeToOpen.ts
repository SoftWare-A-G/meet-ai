import { useEffect, useRef } from 'react'

type SwipeOptions = {
  onOpen: () => void
  onClose?: () => void
  edgeZone?: number
  threshold?: number
}

/**
 * Detects left-to-right swipe from the left edge to open,
 * and right-to-left swipe anywhere to close.
 * Only activates on touch devices at ≤700px viewport width.
 */
export function useSwipeToOpen(
  containerRef: React.RefObject<HTMLElement | null>,
  { onOpen, onClose, edgeZone = 30, threshold = 50 }: SwipeOptions
) {
  const touchStart = useRef<{ x: number; y: number; fromEdge: boolean } | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    function isMobile() {
      return window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 700
    }

    function handleTouchStart(e: TouchEvent) {
      if (!isMobile()) return
      const touch = e.touches[0]
      touchStart.current = {
        x: touch.clientX,
        y: touch.clientY,
        fromEdge: touch.clientX <= edgeZone,
      }
    }

    function handleTouchEnd(e: TouchEvent) {
      if (!touchStart.current || !isMobile()) return
      const touch = e.changedTouches[0]
      const dx = touch.clientX - touchStart.current.x
      const dy = touch.clientY - touchStart.current.y
      const start = touchStart.current
      touchStart.current = null

      // Must be mostly horizontal
      if (Math.abs(dy) > Math.abs(dx)) return

      // Swipe right from left edge → open
      if (start.fromEdge && dx >= threshold) {
        onOpen()
        return
      }

      // Swipe left anywhere → close
      if (onClose && dx <= -threshold) {
        onClose()
      }
    }

    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchend', handleTouchEnd)
    }
  }, [containerRef, onOpen, onClose, edgeZone, threshold])
}
