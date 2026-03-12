import { test, expect, describe } from 'bun:test'
import { homeConfigSchema, envSchema } from '@meet-ai/cli/lib/config-schema'

describe('envSchema', () => {
  test('valid env passes validation', () => {
    const result = envSchema.safeParse({ url: 'https://meet-ai.cc', key: 'mai_abc123' })
    expect(result.success).toBe(true)
  })

  test('invalid URL fails validation', () => {
    const result = envSchema.safeParse({ url: 'not-a-url', key: 'mai_abc123' })
    expect(result.success).toBe(false)
  })

  test('key without mai_ prefix fails validation', () => {
    const result = envSchema.safeParse({ url: 'https://meet-ai.cc', key: 'bad_key' })
    expect(result.success).toBe(false)
  })
})

describe('homeConfigSchema', () => {
  test('valid config passes validation', () => {
    const result = homeConfigSchema.safeParse({
      defaultEnv: 'prod',
      envs: {
        prod: { url: 'https://meet-ai.cc', key: 'mai_prod_123' },
      },
    })
    expect(result.success).toBe(true)
  })

  test('config with $schema field passes', () => {
    const result = homeConfigSchema.safeParse({
      $schema: 'https://meet-ai.cc/schemas/config.json',
      defaultEnv: 'prod',
      envs: {
        prod: { url: 'https://meet-ai.cc', key: 'mai_prod_123' },
      },
    })
    expect(result.success).toBe(true)
  })

  test('missing defaultEnv fails', () => {
    const result = homeConfigSchema.safeParse({
      envs: {
        prod: { url: 'https://meet-ai.cc', key: 'mai_prod_123' },
      },
    })
    expect(result.success).toBe(false)
  })

  test('defaultEnv pointing to non-existent env fails', () => {
    const result = homeConfigSchema.safeParse({
      defaultEnv: 'staging',
      envs: {
        prod: { url: 'https://meet-ai.cc', key: 'mai_prod_123' },
      },
    })
    expect(result.success).toBe(false)
  })

  test('empty envs with any defaultEnv fails', () => {
    const result = homeConfigSchema.safeParse({
      defaultEnv: 'prod',
      envs: {},
    })
    expect(result.success).toBe(false)
  })

  test('invalid URL inside env fails', () => {
    const result = homeConfigSchema.safeParse({
      defaultEnv: 'prod',
      envs: {
        prod: { url: 'not-a-url', key: 'mai_prod_123' },
      },
    })
    expect(result.success).toBe(false)
  })

  test('key without mai_ prefix inside env fails', () => {
    const result = homeConfigSchema.safeParse({
      defaultEnv: 'prod',
      envs: {
        prod: { url: 'https://meet-ai.cc', key: 'bad_key' },
      },
    })
    expect(result.success).toBe(false)
  })

  test('multiple envs pass when defaultEnv references one', () => {
    const result = homeConfigSchema.safeParse({
      defaultEnv: 'staging',
      envs: {
        prod: { url: 'https://meet-ai.cc', key: 'mai_prod_123' },
        staging: { url: 'https://staging.meet-ai.cc', key: 'mai_staging_456' },
      },
    })
    expect(result.success).toBe(true)
  })
})
