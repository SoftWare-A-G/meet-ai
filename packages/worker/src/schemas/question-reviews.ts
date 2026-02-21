import { z } from 'zod/v4'

export const createQuestionReviewSchema = z.object({
  questions_json: z.string().min(1),
  formatted_content: z.string().min(1),
})

export const answerQuestionReviewSchema = z.object({
  answers: z.record(z.string(), z.string()),
  answered_by: z.string().min(1),
})
