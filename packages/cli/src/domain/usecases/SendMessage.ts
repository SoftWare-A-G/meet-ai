import type IMessageRepository from '@meet-ai/cli/domain/interfaces/IMessageRepository'

export default class SendMessage {
  constructor(private readonly messageRepository: IMessageRepository) {}

  async execute(roomId: string, sender: string, content: string, color?: string) {
    return this.messageRepository.send(roomId, sender, content, color)
  }
}
