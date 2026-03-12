import { z } from 'zod'

export const envSchema = z.object({
  url: z.string().url(),
  key: z.string().startsWith('mai_'),
})

export type EnvConfig = z.infer<typeof envSchema>

/** Base schema without the defaultEnv-in-envs refinement (for loose reads). */
export const homeConfigBaseSchema = z.object({
  $schema: z.string().optional(),
  defaultEnv: z.string(),
  envs: z.record(z.string(), envSchema),
})

export const homeConfigSchema = homeConfigBaseSchema.refine(
  data => data.defaultEnv in data.envs,
  { message: 'defaultEnv must reference an existing environment' }
)

export type HomeConfig = z.infer<typeof homeConfigSchema>
