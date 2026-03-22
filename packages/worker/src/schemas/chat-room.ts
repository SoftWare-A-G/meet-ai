import { z } from 'zod/v4'
import {
  teamInfoSchema,
  teamInfoMemberSchema,
  teamInfoUpsertSchema,
  commandsSchema,
  createTaskSchema,
  updateTaskSchema,
  upsertTaskSchema,
} from './rooms'

// Re-export shared schemas used by ChatRoom DO routes
export {
  teamInfoSchema,
  teamInfoMemberSchema,
  teamInfoUpsertSchema,
  commandsSchema,
  createTaskSchema,
  updateTaskSchema,
  upsertTaskSchema,
}

// --- Broadcast ---

export const broadcastSchema = z.object({
  data: z.string(),
})
export type Broadcast = z.infer<typeof broadcastSchema>

// --- Terminal ---

export const terminalSchema = z.object({
  type: z.literal('terminal_data'),
  data: z.string(),
})
export type Terminal = z.infer<typeof terminalSchema>

// --- StoredTask (canonical source of truth) ---

export const storedTaskSchema = z.object({
  id: z.string(),
  subject: z.string(),
  description: z.string().optional(),
  status: z.string(),
  assignee: z.string().nullable(),
  owner: z.string().nullable(),
  source: z.string(),
  source_id: z.string().nullable(),
  updated_by: z.string().nullable(),
  updated_at: z.number(),
})
export type StoredTask = z.infer<typeof storedTaskSchema>

// --- Tasks full replace (POST /tasks) ---

export const tasksFullReplaceSchema = z.object({
  tasks: z.array(storedTaskSchema),
})
export type TasksFullReplace = z.infer<typeof tasksFullReplaceSchema>
