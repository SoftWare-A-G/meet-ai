import type { ApiError } from '@meet-ai/domain'
import type { Result } from 'better-result'
import type IAttachmentRepository from '@meet-ai/cli/domain/interfaces/IAttachmentRepository'

export default class DownloadAttachment {
  constructor(private readonly attachmentRepository: IAttachmentRepository) {}

  execute(attachmentId: string): Promise<Result<Response, ApiError>> {
    return this.attachmentRepository.download(attachmentId)
  }
}
