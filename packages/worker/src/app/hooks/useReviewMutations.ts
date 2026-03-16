import { useMutation } from '@tanstack/react-query'
import { useRoomStore, emptyDecisionsData } from '../stores/useRoomStore'
import type { DecisionsData } from '../stores/useRoomStore'
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

/** Snapshot the current decisions for a room so we can rollback on error */
function snapshotDecisions(roomId: string): DecisionsData {
  return useRoomStore.getState().decisions[roomId] ?? emptyDecisionsData()
}

/** Restore a previous decisions snapshot on mutation error */
function rollbackDecisions(roomId: string, prev: DecisionsData) {
  useRoomStore.setState((s) => ({
    decisions: { ...s.decisions, [roomId]: prev },
  }))
}

export function useReviewMutations(roomId: string, userName: string) {
  const { setPlanDecision, setQuestionAnswer, setPermissionDecision } = useRoomStore.getState()

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
    onMutate: (vars) => {
      const prev = snapshotDecisions(roomId)
      setPlanDecision(roomId, vars.reviewId, {
        status: vars.approved ? 'approved' : 'denied',
        feedback: vars.feedback,
        permissionMode: vars.permission_mode,
      })
      return { prev }
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) rollbackDecisions(roomId, context.prev)
    },
  })

  const expirePlan = useMutation({
    mutationFn: ({ reviewId }: ExpirePlanVars) => expirePlanReview({
      param: { id: roomId, reviewId },
    }),
    onMutate: (vars) => {
      const prev = snapshotDecisions(roomId)
      setPlanDecision(roomId, vars.reviewId, { status: 'expired' })
      return { prev }
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) rollbackDecisions(roomId, context.prev)
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
    onMutate: (vars) => {
      const prev = snapshotDecisions(roomId)
      setQuestionAnswer(roomId, vars.reviewId, { status: 'answered', answers: vars.answers })
      return { prev }
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) rollbackDecisions(roomId, context.prev)
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
    onMutate: (vars) => {
      const prev = snapshotDecisions(roomId)
      setPermissionDecision(roomId, vars.reviewId, {
        status: vars.approved ? 'approved' : 'denied',
        feedback: vars.feedback,
      })
      return { prev }
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) rollbackDecisions(roomId, context.prev)
    },
  })

  return {
    decidePlan,
    expirePlan,
    answerQuestion: answerQuestionMutation,
    decidePermission: decidePermissionMutation,
  }
}
