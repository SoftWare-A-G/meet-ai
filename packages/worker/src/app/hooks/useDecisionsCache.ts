import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '../lib/query-keys'
import { useRoomTimeline } from './useRoomTimeline'

type PlanDecisionEntry = {
  status: 'pending' | 'approved' | 'denied' | 'expired'
  feedback?: string
  permissionMode?: string
}

type QuestionDecisionEntry = {
  status: 'pending' | 'answered' | 'expired'
  answers?: Record<string, string>
}

type PermissionDecisionEntry = {
  status: 'pending' | 'approved' | 'denied' | 'expired'
  feedback?: string
}

export type DecisionsData = {
  plan: Record<string, PlanDecisionEntry>
  question: Record<string, QuestionDecisionEntry>
  permission: Record<string, PermissionDecisionEntry>
}

export function emptyDecisionsData(): DecisionsData {
  return { plan: {}, question: {}, permission: {} }
}

export function useDecisionsCache(roomId: string) {
  const { data: timeline = [] } = useRoomTimeline(roomId)

  const { data: wsOverrides = emptyDecisionsData() } = useQuery({
    queryKey: queryKeys.rooms.decisions(roomId),
    queryFn: emptyDecisionsData,
    initialData: emptyDecisionsData,
    staleTime: Infinity,
  })

  const planDecisions = useMemo(() => {
    const merged = { ...wsOverrides.plan }
    for (const msg of timeline) {
      if (msg.plan_review_id && msg.plan_review_status && !(msg.plan_review_id in merged)) {
        merged[msg.plan_review_id] = {
          status: msg.plan_review_status,
          feedback: msg.plan_review_feedback,
        }
      }
    }
    return merged
  }, [timeline, wsOverrides.plan])

  const questionAnswers = useMemo(() => {
    const merged = { ...wsOverrides.question }
    for (const msg of timeline) {
      if (msg.question_review_id && msg.question_review_status && !(msg.question_review_id in merged)) {
        merged[msg.question_review_id] = {
          status: msg.question_review_status,
          answers: msg.question_review_answers
            ? JSON.parse(msg.question_review_answers)
            : undefined,
        }
      }
    }
    return merged
  }, [timeline, wsOverrides.question])

  const permissionDecisions = useMemo(() => {
    const merged = { ...wsOverrides.permission }
    for (const msg of timeline) {
      if (msg.permission_review_id && msg.permission_review_status && !(msg.permission_review_id in merged)) {
        merged[msg.permission_review_id] = {
          status: msg.permission_review_status,
          feedback: msg.permission_review_feedback,
        }
      }
    }
    return merged
  }, [timeline, wsOverrides.permission])

  return { planDecisions, questionAnswers, permissionDecisions }
}
