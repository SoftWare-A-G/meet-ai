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

// --- Stored team info (storage-specific schemas) ---

export const storedTeamInfoMemberSchema = teamInfoMemberSchema.extend({
  teammate_id: z.string(),
})
export type StoredTeamInfoMember = z.infer<typeof storedTeamInfoMemberSchema>

export const storedTeamInfoSchema = z.object({
  type: z.literal('team_info'),
  team_name: z.string(),
  members: z.array(storedTeamInfoMemberSchema),
})
export type StoredTeamInfo = z.infer<typeof storedTeamInfoSchema>

// --- Broadcast event types (discriminated union) ---

export const chatRoomMessageEventSchema = z.object({
  type: z.literal('message'),
  id: z.string(),
  room_id: z.string(),
  sender: z.string(),
  sender_type: z.enum(['agent', 'human']),
  content: z.string(),
  color: z.string().nullable(),
  seq: z.number(),
  created_at: z.string(),
  attachment_count: z.number(),
  question_review_id: z.string().optional(),
  question_review_status: z.string().optional(),
  permission_review_id: z.string().optional(),
  permission_review_status: z.string().optional(),
  plan_review_id: z.string().optional(),
})
export type ChatRoomMessageEvent = z.infer<typeof chatRoomMessageEventSchema>

export const chatRoomLogEventSchema = z.object({
  type: z.literal('log'),
  id: z.string(),
  room_id: z.string(),
  message_id: z.string().nullable(),
  sender: z.string(),
  content: z.string(),
  color: z.string().nullable(),
  created_at: z.string(),
})
export type ChatRoomLogEvent = z.infer<typeof chatRoomLogEventSchema>

export const chatRoomQuestionAnswerEventSchema = z.object({
  type: z.literal('question_answer'),
  question_review_id: z.string(),
  status: z.enum(['answered', 'expired']),
  answers: z.record(z.string(), z.string()).optional(),
  answered_by: z.string().optional(),
})
export type ChatRoomQuestionAnswerEvent = z.infer<typeof chatRoomQuestionAnswerEventSchema>

export const chatRoomPermissionDecisionEventSchema = z.object({
  type: z.literal('permission_decision'),
  permission_review_id: z.string(),
  status: z.enum(['approved', 'denied', 'expired']),
  feedback: z.string().nullable().optional(),
  decided_by: z.string().optional(),
})
export type ChatRoomPermissionDecisionEvent = z.infer<typeof chatRoomPermissionDecisionEventSchema>

export const chatRoomPlanDecisionEventSchema = z.object({
  type: z.literal('plan_decision'),
  plan_review_id: z.string(),
  status: z.enum(['approved', 'denied', 'expired']),
  feedback: z.string().nullable().optional(),
  decided_by: z.string().optional(),
  permission_mode: z.string().optional(),
})
export type ChatRoomPlanDecisionEvent = z.infer<typeof chatRoomPlanDecisionEventSchema>

export const chatRoomBroadcastSchema = z.discriminatedUnion('type', [
  chatRoomMessageEventSchema,
  chatRoomLogEventSchema,
  chatRoomQuestionAnswerEventSchema,
  chatRoomPermissionDecisionEventSchema,
  chatRoomPlanDecisionEventSchema,
])
export type ChatRoomBroadcast = z.infer<typeof chatRoomBroadcastSchema>

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
