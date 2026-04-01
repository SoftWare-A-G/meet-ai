import { z } from 'zod/v4'
import { QuestionReviewStatusSchema } from './review'

export const QuestionReviewSchema = z.object({
  id: z.string(),
  messageId: z.string(),
  roomId: z.string(),
  questionsJson: z.string(),
  status: QuestionReviewStatusSchema,
  answersJson: z.string().nullable(),
  answeredBy: z.string().nullable(),
  answeredAt: z.string().nullable(),
  createdAt: z.string(),
})
export type QuestionReview = z.infer<typeof QuestionReviewSchema>
