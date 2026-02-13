import { defineWorkersConfig, readD1Migrations } from '@cloudflare/vitest-pool-workers/config'
import path from 'node:path'

export default defineWorkersConfig(async () => {
  const migrationsPath = path.join(__dirname, 'migrations')
  const migrations = await readD1Migrations(migrationsPath)

  return {
    test: {
      pool: '@cloudflare/vitest-pool-workers',
      poolOptions: {
        workers: {
          isolatedStorage: false,
          wrangler: { configPath: './wrangler.toml' },
          miniflare: {
            compatibilityFlags: [
              'enable_nodejs_tty_module',
              'enable_nodejs_fs_module',
              'enable_nodejs_http_modules',
              'enable_nodejs_perf_hooks_module',
            ],
            d1Databases: ['DB'],
            kvNamespaces: ['UPLOADS'],
            bindings: { TEST_MIGRATIONS: migrations },
          },
        },
      },
    },
  }
})
