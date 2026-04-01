import { z } from 'zod/v4'

export const SenderTypeSchema = z.enum(['human', 'agent'])
export type SenderType = z.infer<typeof SenderTypeSchema>

export const MessageTypeSchema = z.enum(['message', 'log'])
export type MessageType = z.infer<typeof MessageTypeSchema>

export const MessageSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  sender: z.string(),
  senderType: SenderTypeSchema,
  content: z.string(),
  color: z.string().nullable(),
  type: MessageTypeSchema,
  seq: z.number().nullable(),
  createdAt: z.string(),
})
export type Message = z.infer<typeof MessageSchema>
