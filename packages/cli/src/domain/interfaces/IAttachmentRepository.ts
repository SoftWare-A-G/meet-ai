import type { AttachmentMeta } from '@meet-ai/cli/types'
import type { ApiError } from '@meet-ai/domain'
import type { Result } from 'better-result'

export default interface IAttachmentRepository {
  listForMessage(roomId: string, messageId: string): Promise<Result<AttachmentMeta[], ApiError>>
  download(attachmentId: string): Promise<Result<Response, ApiError>>
}
