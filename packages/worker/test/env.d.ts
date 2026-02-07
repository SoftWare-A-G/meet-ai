import type { D1Migration } from '@cloudflare/vitest-pool-workers/config'

declare module 'cloudflare:test' {
  interface ProvidedEnv {
    DB: D1Database
    CHAT_ROOM: DurableObjectNamespace
    TEST_MIGRATIONS: D1Migration[]
  }
}
