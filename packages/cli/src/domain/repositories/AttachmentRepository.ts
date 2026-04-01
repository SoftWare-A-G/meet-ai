import type { AttachmentMeta } from '@meet-ai/cli/types'
import type IHttpTransport from '@meet-ai/cli/domain/interfaces/IHttpTransport'
import type IAttachmentRepository from '@meet-ai/cli/domain/interfaces/IAttachmentRepository'

type WireAttachment = { id: string; filename: string; size: number; content_type: string }

function mapAttachment(raw: WireAttachment): AttachmentMeta {
  return { id: raw.id, filename: raw.filename, size: raw.size, contentType: raw.content_type }
}

export default class AttachmentRepository implements IAttachmentRepository {
  constructor(private readonly transport: IHttpTransport) {}

  async listForMessage(roomId: string, messageId: string): Promise<AttachmentMeta[]> {
    const raw = await this.transport.getJson<WireAttachment[]>(
      `/api/rooms/${roomId}/messages/${messageId}/attachments`
    )
    return raw.map(mapAttachment)
  }

  async download(attachmentId: string): Promise<Response> {
    return this.transport.getRaw(`/api/attachments/${attachmentId}`)
  }
}
