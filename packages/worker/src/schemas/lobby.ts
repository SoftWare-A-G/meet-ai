import { z } from 'zod/v4'

export const roomCreatedSchema = z.object({
  type: z.literal('room_created'),
  id: z.string(),
  name: z.string(),
  created_at: z.string(),
  project_id: z.string().nullable(),
  project_name: z.string().nullable(),
  project_created_at: z.string().nullable(),
  project_updated_at: z.string().nullable(),
})
export type RoomCreated = z.infer<typeof roomCreatedSchema>

export const roomDeletedSchema = z.object({
  type: z.literal('room_deleted'),
  id: z.string(),
})
export type RoomDeleted = z.infer<typeof roomDeletedSchema>

export const lobbyBroadcastSchema = z.discriminatedUnion('type', [
  roomCreatedSchema,
  roomDeletedSchema,
])
export type LobbyBroadcast = z.infer<typeof lobbyBroadcastSchema>

export const spawnRequestSchema = z.object({
  type: z.literal('spawn_request'),
  room_name: z.string(),
  coding_agent: z.string().optional(),
})
export type SpawnRequest = z.infer<typeof spawnRequestSchema>
