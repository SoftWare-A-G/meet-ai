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
