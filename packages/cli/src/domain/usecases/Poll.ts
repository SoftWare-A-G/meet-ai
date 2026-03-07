import type IMessageRepository from '@meet-ai/cli/domain/interfaces/IMessageRepository'
import type { ListMessagesOptions } from '@meet-ai/cli/domain/interfaces/IMessageRepository'

export default class Poll {
  constructor(private readonly messageRepository: IMessageRepository) {}

  async execute(roomId: string, opts?: ListMessagesOptions) {
    return this.messageRepository.list(roomId, opts)
  }
}
