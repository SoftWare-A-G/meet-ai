import { useCallback, useRef, useEffect, useState } from 'react'
import type { RefObject } from 'react'

export function useScrollAnchor(ref: RefObject<HTMLDivElement | null>, bottomRef?: RefObject<HTMLDivElement | null>) {
  const wasAtBottomRef = useRef(true)
  const [atBottom, setAtBottom] = useState(true)
  const rafId = useRef<number>(0) as { current: number }
  const retryTimerId = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Track scroll position continuously so we know the state *before* new messages arrive
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const handler = () => {
      const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150
      wasAtBottomRef.current = bottom
      setAtBottom(bottom)
    }
    el.addEventListener('scroll', handler, { passive: true })
    return () => el.removeEventListener('scroll', handler)
  }, [ref])

  const isAtBottom = useCallback(
    (): boolean => (wasAtBottomRef.current ?? true),
    [],
  )

  const scrollToBottom = useCallback(() => {
    cancelAnimationFrame(rafId.current)
    if (retryTimerId.current) clearTimeout(retryTimerId.current)

    const doScroll = () => {
      if (bottomRef?.current) {
        bottomRef.current.scrollIntoView({ block: 'end' })
      } else {
        const el = ref.current
        if (!el) return
        el.scrollTop = el.scrollHeight
      }
      wasAtBottomRef.current = true
      setAtBottom(true)
    }

    rafId.current = requestAnimationFrame(() => {
      doScroll()
      // Retry after a short delay to catch late-rendering content
      retryTimerId.current = setTimeout(doScroll, 100)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps -- rafId is a stable ref
  }, [ref, bottomRef])

  // Clean up pending animation frame and retry timer on unmount
  // eslint-disable-next-line react-hooks/exhaustive-deps -- rafId/retryTimerId are stable refs
  useEffect(() => () => {
    cancelAnimationFrame(rafId.current)
    if (retryTimerId.current) clearTimeout(retryTimerId.current)
  }, [])

  return { isAtBottom, atBottom, scrollToBottom }
}
