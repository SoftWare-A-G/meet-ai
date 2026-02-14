import { z } from 'zod/v4'

export const createRoomSchema = z.object({
  name: z.string().min(1),
})

export const sendMessageSchema = z.object({
  sender: z.string().min(1),
  content: z.string().min(1),
  sender_type: z.enum(['agent', 'human']).optional(),
  color: z.string().optional(),
  attachment_ids: z.array(z.string()).optional(),
})

export const sendLogSchema = z.object({
  sender: z.string().min(1),
  content: z.string().min(1),
  color: z.string().optional(),
  message_id: z.string().optional(),
})

export const teamInfoMemberSchema = z.object({
  name: z.string(),
  color: z.string(),
  role: z.string(),
  model: z.string(),
  status: z.enum(['active', 'inactive']),
  joinedAt: z.number(),
})

export const teamInfoSchema = z.object({
  team_name: z.string(),
  members: z.array(teamInfoMemberSchema),
})
