import { z } from 'zod/v4'

export const linkAttachmentSchema = z.object({
  message_id: z.string().min(1),
})
