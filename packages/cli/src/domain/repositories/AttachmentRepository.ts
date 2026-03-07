import type { AttachmentMeta } from '@meet-ai/cli/types'
import type IHttpTransport from '@meet-ai/cli/domain/interfaces/IHttpTransport'
import type IAttachmentRepository from '@meet-ai/cli/domain/interfaces/IAttachmentRepository'

export default class AttachmentRepository implements IAttachmentRepository {
  constructor(private readonly transport: IHttpTransport) {}

  async listForMessage(roomId: string, messageId: string): Promise<AttachmentMeta[]> {
    return this.transport.getJson<AttachmentMeta[]>(
      `/api/rooms/${roomId}/messages/${messageId}/attachments`
    )
  }

  async download(attachmentId: string): Promise<Response> {
    return this.transport.getRaw(`/api/attachments/${attachmentId}`)
  }
}
