import { useCallback } from 'react'
import { useWebHaptics } from 'web-haptics/react'
import type { Message } from '../lib/types'

function isSpecialMessage(msg: Message): boolean {
  return !!(msg.plan_review_id || msg.question_review_id || msg.permission_review_id)
}

export function useHaptics() {
  const { trigger } = useWebHaptics()

  const triggerForMessage = useCallback((msg: Message) => {
    const heavy = isSpecialMessage(msg)
    trigger(heavy ? 'heavy' : 'light')
  }, [trigger])

  return { triggerForMessage }
}
