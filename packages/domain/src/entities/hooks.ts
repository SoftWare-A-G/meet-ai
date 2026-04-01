import { z } from 'zod/v4'

export const PermissionRequestInputSchema = z.object({
  session_id: z.string().min(1),
  transcript_path: z.string().optional(),
  hook_event_name: z.literal('PermissionRequest'),
  tool_name: z.string().min(1),
  tool_input: z.record(z.string(), z.unknown()).optional(),
})

export type PermissionRequestInput = z.infer<typeof PermissionRequestInputSchema>

export const QuestionOptionSchema = z.object({
  label: z.string(),
  description: z.string().optional(),
})
export type QuestionOption = z.infer<typeof QuestionOptionSchema>

export const QuestionItemSchema = z.object({
  question: z.string(),
  header: z.string().optional(),
  options: z.array(QuestionOptionSchema),
  multiSelect: z.boolean().optional(),
})
export type QuestionItem = z.infer<typeof QuestionItemSchema>

export const QuestionRequestInputSchema = z.object({
  session_id: z.string().min(1),
  transcript_path: z.string().optional(),
  hook_event_name: z.literal('PermissionRequest'),
  tool_name: z.literal('AskUserQuestion'),
  tool_input: z.object({
    questions: z.array(QuestionItemSchema).min(1),
    answers: z.record(z.string(), z.string()).optional(),
  }),
})
export type QuestionRequestInput = z.infer<typeof QuestionRequestInputSchema>

export const PlanRequestInputSchema = z.object({
  session_id: z.string().min(1),
  transcript_path: z.string().optional(),
  hook_event_name: z.literal('PermissionRequest'),
  tool_name: z.literal('ExitPlanMode'),
  tool_input: z.object({ plan: z.string().optional() }).optional(),
})
export type PlanRequestInput = z.infer<typeof PlanRequestInputSchema>

// Task hook schemas (PostToolUse events)

const taskHookBaseSchema = z.object({
  session_id: z.string().min(1),
  transcript_path: z.string().optional(),
  hook_event_name: z.literal('PostToolUse'),
  tool_use_id: z.string(),
})

export const TaskCreateHookInputSchema = taskHookBaseSchema.extend({
  tool_name: z.literal('TaskCreate'),
  tool_input: z.object({ subject: z.string(), description: z.string().optional() }),
  tool_response: z.object({ task: z.object({ id: z.string(), subject: z.string() }) }),
})

export const TaskUpdateHookInputSchema = taskHookBaseSchema.extend({
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
    statusChange: z.object({ from: z.string(), to: z.string() }).optional(),
  }),
})

export const TaskHookInputSchema = z.discriminatedUnion('tool_name', [
  TaskCreateHookInputSchema,
  TaskUpdateHookInputSchema,
])

export type TaskCreateHookInput = z.infer<typeof TaskCreateHookInputSchema>
export type TaskUpdateHookInput = z.infer<typeof TaskUpdateHookInputSchema>
export type TaskHookInput = z.infer<typeof TaskHookInputSchema>
