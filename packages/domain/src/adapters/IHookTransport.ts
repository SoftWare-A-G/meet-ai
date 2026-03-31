import type { Result } from 'better-result'
import type { NotifyError } from '../entities/errors'

export interface IHookTransport {
  sendTimeoutMessage(roomId: string): Promise<Result<void, NotifyError>>
}
