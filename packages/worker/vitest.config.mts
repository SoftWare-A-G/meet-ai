import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readD1Migrations, cloudflareTest } from '@cloudflare/vitest-pool-workers'
import { defineConfig } from 'vitest/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(async () => {
  const migrationsPath = path.join(__dirname, 'migrations')
  const migrations = await readD1Migrations(migrationsPath)

  return {
    plugins: [
      cloudflareTest({
        main: './src/index.ts',
        wrangler: { configPath: './wrangler.toml' },
        miniflare: {
          d1Databases: ['DB'],
          kvNamespaces: ['UPLOADS', 'PRESENCE'],
          bindings: { TEST_MIGRATIONS: migrations },
        },
      }),
    ],
  }
})
