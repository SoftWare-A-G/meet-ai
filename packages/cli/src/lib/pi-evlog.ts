import { initLogger, log } from 'evlog'

type PiLogLevel = 'debug' | 'info' | 'warn' | 'error'
type PiLogComponent = 'pi-rpc' | 'listen-pi'

let initialized = false

function ensureInitialized() {
  if (initialized) return

  initLogger({
    env: {
      service: 'meet-ai-pi',
      environment: process.env.NODE_ENV ?? 'development',
    },
    pretty: true,
    stringify: false,
  })

  initialized = true
}

export function emitPiLog(
  level: PiLogLevel,
  component: PiLogComponent,
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
