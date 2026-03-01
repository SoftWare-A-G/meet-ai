import { z } from 'zod'

const SpawnRequestSchema = z.object({
  type: z.literal('spawn_request'),
  room_name: z.string().min(1),
  prompt: z.string().min(1),
  model: z.string().optional(),
})

const KillRequestSchema = z.object({
  type: z.literal('kill_request'),
  room_id: z.string().min(1),
})

export type ControlMessage = z.infer<typeof SpawnRequestSchema> | z.infer<typeof KillRequestSchema>

export function parseControlMessage(raw: unknown): ControlMessage | null {
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!data?.type) return null

    if (data.type === 'spawn_request') {
      const result = SpawnRequestSchema.safeParse(data)
      return result.success ? result.data : null
    }
    if (data.type === 'kill_request') {
      const result = KillRequestSchema.safeParse(data)
      return result.success ? result.data : null
    }

    return null
  } catch {
    return null
  }
}
