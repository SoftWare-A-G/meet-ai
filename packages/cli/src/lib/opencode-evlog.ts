import { initLogger, log } from 'evlog'

type OpencodeLogLevel = 'debug' | 'info' | 'warn' | 'error'
type OpencodeLogComponent = 'opencode-sdk' | 'listen-opencode' | 'opencode-events'

let initialized = false

function ensureInitialized() {
  if (initialized) return

  initLogger({
    env: {
      service: 'meet-ai-opencode',
      environment: process.env.NODE_ENV ?? 'development',
    },
    pretty: true,
    stringify: false,
  })

  initialized = true
}

export function emitOpencodeLog(
  level: OpencodeLogLevel,
  component: OpencodeLogComponent,
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
      break
    }
    case 'info': {
      log.info(payload)
      break
    }
    case 'warn': {
      log.warn(payload)
      break
    }
    case 'error': {
      log.error(payload)
      break
    }
  }
}
