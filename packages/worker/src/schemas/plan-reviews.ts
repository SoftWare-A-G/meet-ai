import { z } from 'zod/v4'

export const createPlanReviewSchema = z.object({
  plan_content: z.string().min(1),
  permission_mode: z.string().optional(),
})

export const decidePlanReviewSchema = z.object({
  approved: z.boolean(),
  feedback: z.string().optional(),
  decided_by: z.string().min(1),
})
