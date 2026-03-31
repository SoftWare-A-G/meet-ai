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

export const HookOutputSchema = z.object({
  hookSpecificOutput: z.object({
    hookEventName: z.literal('PermissionRequest'),
    decision: z.union([
      z.object({ behavior: z.literal('allow') }),
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
