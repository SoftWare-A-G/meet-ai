import { z } from 'zod/v4'

export const canvasMutationsSchema = z.object({
  puts: z.array(z.record(z.string(), z.unknown()).and(z.object({ id: z.string() }))).optional(),
  deletes: z.array(z.string()).optional(),
})
