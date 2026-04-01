import type { ApiError } from '@meet-ai/domain'
import type { Result } from 'better-result'
import type { Message } from '@meet-ai/cli/types'
import type IMessageRepository from '@meet-ai/cli/domain/interfaces/IMessageRepository'
import type { ListMessagesOptions } from '@meet-ai/cli/domain/interfaces/IMessageRepository'

export default class Poll {
  constructor(private readonly messageRepository: IMessageRepository) {}

  execute(roomId: string, opts?: ListMessagesOptions): Promise<Result<Message[], ApiError>> {
    return this.messageRepository.list(roomId, opts)
  }
}
