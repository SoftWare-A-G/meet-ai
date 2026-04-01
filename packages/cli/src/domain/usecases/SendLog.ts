import type { ApiError } from '@meet-ai/domain'
import type { Result } from 'better-result'
import type { Message } from '@meet-ai/cli/types'
import type IMessageRepository from '@meet-ai/cli/domain/interfaces/IMessageRepository'
import type { SendLogOptions } from '@meet-ai/cli/domain/interfaces/IMessageRepository'

export default class SendLog {
  constructor(private readonly messageRepository: IMessageRepository) {}

  execute(roomId: string, sender: string, content: string, opts?: SendLogOptions): Promise<Result<Message, ApiError>> {
    return this.messageRepository.sendLog(roomId, sender, content, opts)
  }
}
