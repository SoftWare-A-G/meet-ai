import type { ApiError } from '@meet-ai/domain'
import type { Result } from 'better-result'
import type { Message } from '@meet-ai/cli/types'
import type IMessageRepository from '@meet-ai/cli/domain/interfaces/IMessageRepository'

export default class SendMessage {
  constructor(private readonly messageRepository: IMessageRepository) {}

  execute(roomId: string, sender: string, content: string, color?: string): Promise<Result<Message, ApiError>> {
    return this.messageRepository.send(roomId, sender, content, color)
  }
}
