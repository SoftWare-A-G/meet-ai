import { z } from 'zod'

const baseHookInput = z.object({
  session_id: z.string(),
  transcript_path: z.string().optional(),
  tool_use_id: z.string(),
})

export const TaskCreateHookInput = baseHookInput.extend({
  tool_name: z.literal('TaskCreate'),
  tool_input: z.object({
    subject: z.string(),
    description: z.string().optional(),
  }),
  tool_response: z.object({
    task: z.object({
      id: z.string(),
      subject: z.string(),
    }),
  }),
})

export const TaskUpdateHookInput = baseHookInput.extend({
  tool_name: z.literal('TaskUpdate'),
  tool_input: z.object({
    taskId: z.string(),
    status: z.string().optional(),
    owner: z.string().optional(),
    subject: z.string().optional(),
    description: z.string().optional(),
  }),
  tool_response: z.object({
    success: z.boolean(),
    taskId: z.string(),
    updatedFields: z.array(z.string()).optional(),
    statusChange: z.object({
      from: z.string(),
      to: z.string(),
    }).optional(),
  }),
})

export const TaskHookInput = z.discriminatedUnion('tool_name', [
  TaskCreateHookInput,
  TaskUpdateHookInput,
])

export type TaskCreateHookInput = z.infer<typeof TaskCreateHookInput>
export type TaskUpdateHookInput = z.infer<typeof TaskUpdateHookInput>
export type TaskHookInput = z.infer<typeof TaskHookInput>
