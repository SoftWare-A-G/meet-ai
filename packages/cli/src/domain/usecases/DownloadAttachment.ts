import type IAttachmentRepository from '@meet-ai/cli/domain/interfaces/IAttachmentRepository'

export default class DownloadAttachment {
  constructor(private readonly attachmentRepository: IAttachmentRepository) {}

  async execute(attachmentId: string) {
    return this.attachmentRepository.download(attachmentId)
  }
}
