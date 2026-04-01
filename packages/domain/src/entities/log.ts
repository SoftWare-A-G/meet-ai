import { z } from 'zod/v4'

export const LogSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  messageId: z.string().nullable(),
  sender: z.string(),
  content: z.string(),
  color: z.string().nullable(),
  seq: z.number().nullable(),
  createdAt: z.string(),
})
export type Log = z.infer<typeof LogSchema>
