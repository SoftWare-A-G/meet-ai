import { z } from 'zod/v4'

export const PermissionRequestInputSchema = z.object({
  session_id: z.string().min(1),
  transcript_path: z.string().optional(),
  hook_event_name: z.literal('PermissionRequest'),
  tool_name: z.string().min(1),
  tool_input: z.record(z.string(), z.unknown()).optional(),
})

export type PermissionRequestInput = z.infer<typeof PermissionRequestInputSchema>
