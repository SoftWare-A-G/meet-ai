import { useCallback, useRef, useEffect, useState } from 'hono/jsx/dom'
import type { RefObject } from 'hono/jsx/dom'

export function useScrollAnchor(ref: RefObject<HTMLDivElement>) {
  const wasAtBottomRef = useRef(true)
  const [atBottom, setAtBottom] = useState(true)
  const rafId = useRef<number>(0) as { current: number }

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
    rafId.current = requestAnimationFrame(() => {
      const el = ref.current
      if (!el) return
      el.scrollTop = el.scrollHeight
      wasAtBottomRef.current = true
      setAtBottom(true)
    })
  }, [ref])

  // Clean up pending animation frame on unmount
  useEffect(() => () => cancelAnimationFrame(rafId.current), [])

  return { isAtBottom, atBottom, scrollToBottom }
}
