import type { Result } from 'better-result'
import type { NotifyError } from '../entities/errors'

export interface IHookTransport {
  sendTimeoutMessage(roomId: string, content: string, color: string): Promise<Result<void, NotifyError>>
}
