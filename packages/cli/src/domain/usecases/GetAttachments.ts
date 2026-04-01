import type { ApiError } from '@meet-ai/domain'
import type { Result } from 'better-result'
import type { AttachmentMeta } from '@meet-ai/cli/types'
import type IAttachmentRepository from '@meet-ai/cli/domain/interfaces/IAttachmentRepository'

export default class GetAttachments {
  constructor(private readonly attachmentRepository: IAttachmentRepository) {}

  execute(roomId: string, messageId: string): Promise<Result<AttachmentMeta[], ApiError>> {
    return this.attachmentRepository.listForMessage(roomId, messageId)
  }
}
