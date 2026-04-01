import { z } from 'zod/v4'
import { ReviewStatusSchema } from './review'

export const PermissionReviewSchema = z.object({
  id: z.string(),
  messageId: z.string(),
  roomId: z.string(),
  toolName: z.string(),
  toolInputJson: z.string().nullable(),
  formattedContent: z.string(),
  status: ReviewStatusSchema,
  feedback: z.string().nullable(),
  decidedBy: z.string().nullable(),
  decidedAt: z.string().nullable(),
  createdAt: z.string(),
})
export type PermissionReview = z.infer<typeof PermissionReviewSchema>
