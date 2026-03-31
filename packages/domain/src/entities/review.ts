import { z } from 'zod/v4'

export const ReviewStatusSchema = z.enum(['pending', 'approved', 'denied', 'expired'])
export type ReviewStatus = z.infer<typeof ReviewStatusSchema>

export const PermissionReviewDecisionSchema = z.object({
  id: z.string(),
  message_id: z.string(),
  status: ReviewStatusSchema,
  feedback: z.string().nullable(),
  decided_by: z.string().nullable(),
  decided_at: z.string().nullable(),
})
export type PermissionReviewDecision = z.infer<typeof PermissionReviewDecisionSchema>

export const AllowedPromptSchema = z.object({
  tool: z.string(),
  prompt: z.string(),
})
export type AllowedPrompt = z.infer<typeof AllowedPromptSchema>

export const HookOutputSchema = z.object({
  hookSpecificOutput: z.object({
    hookEventName: z.literal('PermissionRequest'),
    decision: z.union([
      z.object({
        behavior: z.literal('allow'),
        updatedInput: z.record(z.string(), z.unknown()).optional(),
        allowedPrompts: z.array(AllowedPromptSchema).optional(),
      }),
      z.object({ behavior: z.literal('deny'), message: z.string() }),
    ]),
  }),
})
export type HookOutput = z.infer<typeof HookOutputSchema>

export const CreateReviewResultSchema = z.object({
  id: z.string(),
  message_id: z.string(),
})
export type CreateReviewResult = z.infer<typeof CreateReviewResultSchema>

export const QuestionReviewStatusSchema = z.enum(['pending', 'answered', 'expired'])
export type QuestionReviewStatus = z.infer<typeof QuestionReviewStatusSchema>

export const QuestionReviewAnswerSchema = z.object({
  id: z.string(),
  message_id: z.string(),
  status: QuestionReviewStatusSchema,
  answers_json: z.string().nullable(),
  answered_by: z.string().nullable(),
  answered_at: z.string().nullable(),
})
export type QuestionReviewAnswer = z.infer<typeof QuestionReviewAnswerSchema>

export const AnswersRecordSchema = z.record(z.string(), z.string())
export type AnswersRecord = z.infer<typeof AnswersRecordSchema>

export const PermissionModeSchema = z.enum(['default', 'acceptEdits', 'bypassPermissions'])
export type PermissionMode = z.infer<typeof PermissionModeSchema>

export const PlanReviewDecisionSchema = z.object({
  id: z.string(),
  message_id: z.string(),
  status: ReviewStatusSchema,
  feedback: z.string().nullable(),
  decided_by: z.string().nullable(),
  decided_at: z.string().nullable(),
  permission_mode: PermissionModeSchema,
})
export type PlanReviewDecision = z.infer<typeof PlanReviewDecisionSchema>
