import { z } from 'zod/v4'

export const RoomSchema = z.object({
  id: z.string(),
  name: z.string(),
  projectId: z.string().nullable(),
  createdAt: z.string(),
})
export type Room = z.infer<typeof RoomSchema>
