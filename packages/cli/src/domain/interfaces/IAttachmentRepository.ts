import type { AttachmentMeta } from '@meet-ai/cli/types'

export default interface IAttachmentRepository {
  listForMessage(roomId: string, messageId: string): Promise<AttachmentMeta[]>
  download(attachmentId: string): Promise<Response>
}
