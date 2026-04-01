import { z } from 'zod/v4'
import { ReviewStatusSchema, PermissionModeSchema } from './review'

export const PlanDecisionSchema = z.object({
  id: z.string(),
  messageId: z.string(),
  roomId: z.string(),
  status: ReviewStatusSchema,
  feedback: z.string().nullable(),
  decidedBy: z.string().nullable(),
  decidedAt: z.string().nullable(),
  permissionMode: PermissionModeSchema.nullable(),
  createdAt: z.string(),
})
export type PlanDecision = z.infer<typeof PlanDecisionSchema>
