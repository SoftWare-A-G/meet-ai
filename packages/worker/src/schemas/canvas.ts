import { z } from 'zod/v4'
import { validateCanvasMutationPuts } from '../lib/canvas-records'

// Validate each put element:
// - z.unknown() input type lets TLRecord[] satisfy the hc client's json parameter type
// - pipe(z.looseObject(...)) ensures id and typeName are strings and preserves all other fields
const rawPutSchema = z.unknown().pipe(z.looseObject({ id: z.string(), typeName: z.string() }))

export const canvasMutationsSchema = z.object({
  puts: z.array(rawPutSchema).optional()
    .transform((puts, ctx) => {
      try {
        return validateCanvasMutationPuts(puts)
      } catch (error) {
        ctx.addIssue({ code: 'custom', message: error instanceof Error ? error.message : 'invalid canvas record' })
        return z.NEVER
      }
    }),
  deletes: z.array(z.string()).optional(),
})
export type CanvasMutations = z.infer<typeof canvasMutationsSchema>

