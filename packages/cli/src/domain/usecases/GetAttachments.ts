import type IAttachmentRepository from '@meet-ai/cli/domain/interfaces/IAttachmentRepository'

export default class GetAttachments {
  constructor(private readonly attachmentRepository: IAttachmentRepository) {}

  async execute(roomId: string, messageId: string) {
    return this.attachmentRepository.listForMessage(roomId, messageId)
  }
}
