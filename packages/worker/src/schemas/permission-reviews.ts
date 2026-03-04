import { z } from 'zod/v4'

export const createPermissionReviewSchema = z.object({
  tool_name: z.string().min(1),
  tool_input_json: z.string().optional(),
  formatted_content: z.string().min(1),
})

export const decidePermissionReviewSchema = z.object({
  approved: z.boolean(),
  feedback: z.string().optional(),
  decided_by: z.string().min(1),
})
