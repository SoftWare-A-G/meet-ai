import type IMessageRepository from '@meet-ai/cli/domain/interfaces/IMessageRepository'
import type { SendLogOptions } from '@meet-ai/cli/domain/interfaces/IMessageRepository'

export default class SendLog {
  constructor(private readonly messageRepository: IMessageRepository) {}

  async execute(roomId: string, sender: string, content: string, opts?: SendLogOptions) {
    return this.messageRepository.sendLog(roomId, sender, content, opts)
  }
}
