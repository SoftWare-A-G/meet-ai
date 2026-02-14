import { useCallback } from 'react'
import type { RefObject } from 'react'

export function useAutoResize(ref: RefObject<HTMLTextAreaElement | null>) {
  const resize = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [ref])

  const reset = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.value = ''
    el.style.height = 'auto'
  }, [ref])

  return { resize, reset }
}
