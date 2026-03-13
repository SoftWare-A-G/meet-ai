import { describe, expect, it } from 'vitest'
import { canvasMutationsSchema } from '../src/schemas/canvas'

describe('canvasMutationsSchema', () => {
  it('accepts puts that include a record type name', () => {
    const result = canvasMutationsSchema.safeParse({
      puts: [{ id: 'shape:1', typeName: 'shape', type: 'geo' }],
    })

    expect(result.success).toBe(true)
  })

  it('rejects puts without a record type name', () => {
    const result = canvasMutationsSchema.safeParse({
      puts: [{ id: 'shape:1', type: 'geo' }],
    })

    expect(result.success).toBe(false)
  })
})
