import path from 'node:path'
import { readD1Migrations, cloudflareTest } from '@cloudflare/vitest-pool-workers'
import { defineConfig } from 'vitest/config'

export default defineConfig(async () => {
  const migrationsPath = path.join(__dirname, 'migrations')
  const migrations = await readD1Migrations(migrationsPath)

  return {
    plugins: [
      cloudflareTest({
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
      }),
    ],
  }
})
