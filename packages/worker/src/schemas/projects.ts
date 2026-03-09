import { z } from 'zod/v4'

export const createProjectSchema = z.object({
  id: z.string().regex(/^[0-9a-f]{16}$/),
  name: z.string().min(1).max(255),
})

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(255),
})
