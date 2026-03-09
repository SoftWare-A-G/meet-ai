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

export const messagesQuerySchema = z.object({
  after: z.string().optional(),
  since_seq: z.coerce.number().int().optional(),
  exclude: z.string().optional(),
  sender_type: z.enum(['agent', 'human']).optional(),
})

export const teamInfoMemberSchema = z.object({
  teammate_id: z.string().optional(),
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

export type TeamInfoPayload = z.infer<typeof teamInfoSchema>

export const teamInfoUpsertSchema = z.object({
  team_name: z.string(),
  member: teamInfoMemberSchema.extend({ teammate_id: z.string() }),
})

export const commandInfoSchema = z.object({
  name: z.string(),
  description: z.string(),
  type: z.string().optional(),
  source: z.string().optional(),
})

export const commandsSchema = z.object({
  commands: z.array(commandInfoSchema),
})

export const createTaskSchema = z.object({
  subject: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  assignee: z.string().max(100).nullable().optional(),
  source: z.enum(['claude', 'codex', 'meet_ai']).optional(),
  source_id: z.string().max(100).nullable().optional(),
  updated_by: z.string().max(100).nullable().optional(),
})

export const updateTaskSchema = z.object({
  subject: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(['pending', 'in_progress', 'completed']).optional(),
  assignee: z.string().max(100).nullable().optional(),
  source: z.enum(['claude', 'codex', 'meet_ai']).optional(),
  source_id: z.string().max(100).nullable().optional(),
  updated_by: z.string().max(100).nullable().optional(),
})

export const upsertTaskSchema = z.object({
  subject: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(['pending', 'in_progress', 'completed']).optional(),
  assignee: z.string().max(100).nullable().optional(),
  source: z.enum(['claude', 'codex', 'meet_ai']),
  source_id: z.string().max(100),
  updated_by: z.string().max(100).nullable().optional(),
})

export const terminalDataSchema = z.object({
  data: z.string().max(1_000_000),
})
