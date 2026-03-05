import { useEffect, useRef, useCallback } from 'react'
import type { Message } from '../lib/types'

type HapticsInstance = {
  trigger: (pattern?: string) => Promise<void>
  destroy: () => void
}

let instance: HapticsInstance | null = null
let initPromise: Promise<HapticsInstance | null> | null = null

function getHaptics(): Promise<HapticsInstance | null> {
  if (instance) return Promise.resolve(instance)
  if (initPromise) return initPromise
  initPromise = import('web-haptics').then(mod => {
    instance = new mod.WebHaptics()
    return instance
  }).catch(() => null)
  return initPromise
}

function isSpecialMessage(msg: Message): boolean {
  return !!(msg.plan_review_id || msg.question_review_id || msg.permission_review_id)
}

export function useHaptics() {
  const hapticsRef = useRef<HapticsInstance | null>(null)

  useEffect(() => {
    getHaptics().then(h => { hapticsRef.current = h })
    return () => { hapticsRef.current = null }
  }, [])

  const triggerForMessage = useCallback((msg: Message) => {
    const h = hapticsRef.current
    if (!h) return

    if (isSpecialMessage(msg)) {
      h.trigger('heavy')
    } else {
      h.trigger('light')
    }
  }, [])

  return { triggerForMessage }
}
