import { initLogger, log } from 'evlog'

type CodexLogLevel = 'debug' | 'info' | 'warn' | 'error'
type CodexLogComponent = 'codex-app-server' | 'listen-codex'

let initialized = false

function ensureInitialized() {
  if (initialized) return

  initLogger({
    env: {
      service: 'meet-ai-codex-app-server',
      environment: process.env.NODE_ENV ?? 'development',
    },
    pretty: true,
    stringify: false,
  })

  initialized = true
}

export function emitCodexAppServerLog(
  level: CodexLogLevel,
  component: CodexLogComponent,
  event: string,
  details: Record<string, unknown> = {}
) {
  ensureInitialized()

  const payload = {
    component,
    event,
    ...details,
  }

  switch (level) {
    case 'debug': {
      log.debug(payload)
      return
    }
    case 'info': {
      log.info(payload)
      return
    }
    case 'warn': {
      log.warn(payload)
      return
    }
    case 'error': {
      log.error(payload)
      return
    }
  }
}
