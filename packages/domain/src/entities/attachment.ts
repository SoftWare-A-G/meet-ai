import { z } from 'zod/v4'

export const AttachmentSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  messageId: z.string().nullable(),
  filename: z.string(),
  size: z.number(),
  contentType: z.string(),
  createdAt: z.string(),
})
export type Attachment = z.infer<typeof AttachmentSchema>
