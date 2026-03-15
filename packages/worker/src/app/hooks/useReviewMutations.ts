import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../lib/query-keys'
import {
  decidePlanReview,
  expirePlanReview,
  answerQuestion,
  decidePermission,
} from '../lib/fetchers'
import type {
  DecidePlanReviewInput,
  ExpirePlanReviewInput,
  AnswerQuestionInput,
  DecidePermissionInput,
} from '../lib/fetchers'
import { emptyDecisionsData } from './useDecisionsCache'
import type { DecisionsData } from './useDecisionsCache'

// Vars types derived from hc InferRequestType — never hand-written
type DecidePlanVars = {
  reviewId: DecidePlanReviewInput['param']['reviewId']
} & Omit<DecidePlanReviewInput['json'], 'decided_by'>

type ExpirePlanVars = {
  reviewId: ExpirePlanReviewInput['param']['reviewId']
}

type AnswerQuestionVars = {
  reviewId: AnswerQuestionInput['param']['reviewId']
} & Omit<AnswerQuestionInput['json'], 'answered_by'>

type DecidePermissionVars = {
  reviewId: DecidePermissionInput['param']['reviewId']
} & Omit<DecidePermissionInput['json'], 'decided_by'>

export function useReviewMutations(roomId: string, userName: string) {
  const queryClient = useQueryClient()
  const decisionsKey = queryKeys.rooms.decisions(roomId)

  const decidePlan = useMutation({
    mutationFn: ({ reviewId, approved, feedback, permission_mode }: DecidePlanVars) => decidePlanReview({
      param: { id: roomId, reviewId },
      json: {
        approved,
        decided_by: userName,
        feedback,
        permission_mode,
      },
    }),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: decisionsKey })
      const prev = queryClient.getQueryData<DecisionsData>(decisionsKey)
      queryClient.setQueryData<DecisionsData>(decisionsKey, old => {
        const current = old ?? emptyDecisionsData()
        return {
          ...current,
          plan: {
            ...current.plan,
            [vars.reviewId]: {
              status: vars.approved ? 'approved' : 'denied',
              feedback: vars.feedback,
              permissionMode: vars.permission_mode,
            },
          },
        }
      })
      return { prev }
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        queryClient.setQueryData(decisionsKey, context.prev)
      }
    },
  })

  const expirePlan = useMutation({
    mutationFn: ({ reviewId }: ExpirePlanVars) => expirePlanReview({
      param: { id: roomId, reviewId },
    }),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: decisionsKey })
      const prev = queryClient.getQueryData<DecisionsData>(decisionsKey)
      queryClient.setQueryData<DecisionsData>(decisionsKey, old => {
        const current = old ?? emptyDecisionsData()
        return {
          ...current,
          plan: {
            ...current.plan,
            [vars.reviewId]: { status: 'expired' },
          },
        }
      })
      return { prev }
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        queryClient.setQueryData(decisionsKey, context.prev)
      }
    },
  })

  const answerQuestionMutation = useMutation({
    mutationFn: ({ reviewId, answers }: AnswerQuestionVars) => answerQuestion({
      param: { id: roomId, reviewId },
      json: {
        answers,
        answered_by: userName,
      },
    }),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: decisionsKey })
      const prev = queryClient.getQueryData<DecisionsData>(decisionsKey)
      queryClient.setQueryData<DecisionsData>(decisionsKey, old => {
        const current = old ?? emptyDecisionsData()
        return {
          ...current,
          question: {
            ...current.question,
            [vars.reviewId]: { status: 'answered', answers: vars.answers },
          },
        }
      })
      return { prev }
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        queryClient.setQueryData(decisionsKey, context.prev)
      }
    },
  })

  const decidePermissionMutation = useMutation({
    mutationFn: ({ reviewId, approved, feedback }: DecidePermissionVars) => decidePermission({
      param: { id: roomId, reviewId },
      json: {
        approved,
        decided_by: userName,
        feedback,
      },
    }),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: decisionsKey })
      const prev = queryClient.getQueryData<DecisionsData>(decisionsKey)
      queryClient.setQueryData<DecisionsData>(decisionsKey, old => {
        const current = old ?? emptyDecisionsData()
        return {
          ...current,
          permission: {
            ...current.permission,
            [vars.reviewId]: {
              status: vars.approved ? 'approved' : 'denied',
              feedback: vars.feedback,
            },
          },
        }
      })
      return { prev }
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        queryClient.setQueryData(decisionsKey, context.prev)
      }
    },
  })

  return {
    decidePlan,
    expirePlan,
    answerQuestion: answerQuestionMutation,
    decidePermission: decidePermissionMutation,
  }
}
