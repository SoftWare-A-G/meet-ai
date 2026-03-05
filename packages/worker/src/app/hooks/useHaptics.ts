import { useCallback } from 'react'
import { useWebHaptics } from 'web-haptics/react'
import type { Message } from '../lib/types'

function isSpecialMessage(msg: Message): boolean {
  return !!(msg.plan_review_id || msg.question_review_id || msg.permission_review_id)
}

function vibrateFallback(heavy: boolean): void {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(heavy ? [35] : [15])
  }
}

export function useHaptics() {
  const { trigger, isSupported } = useWebHaptics()

  const triggerForMessage = useCallback((msg: Message) => {
    const heavy = isSpecialMessage(msg)
    if (isSupported) {
      trigger(heavy ? 'heavy' : 'light')
    } else {
      vibrateFallback(heavy)
    }
  }, [trigger, isSupported])

  return { triggerForMessage }
}
