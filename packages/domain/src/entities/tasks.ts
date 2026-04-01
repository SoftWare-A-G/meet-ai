import { z } from 'zod/v4'

export const TaskStatusSchema = z.enum(['pending', 'in_progress', 'completed'])

export const TaskUpsertPayloadSchema = z.object({
  source: z.enum(['claude', 'codex', 'pi', 'meet_ai', 'opencode']),
  source_id: z.string(),
  subject: z.string().optional(),
  description: z.string().optional(),
  status: TaskStatusSchema.optional(),
  assignee: z.string().nullable().optional(),
  updated_by: z.string().nullable().optional(),
})

export type TaskStatus = z.infer<typeof TaskStatusSchema>
export type TaskUpsertPayload = z.infer<typeof TaskUpsertPayloadSchema>
