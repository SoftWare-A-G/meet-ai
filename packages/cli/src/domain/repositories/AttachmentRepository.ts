import { catchApiError, parseError } from '@meet-ai/cli/domain/lib/api-errors'
import { mapAttachment } from '@meet-ai/cli/domain/mappers/attachment'
import { Result } from 'better-result'
import type { ApiClient } from '@meet-ai/cli/domain/adapters/api-client'
import type IAttachmentRepository from '@meet-ai/cli/domain/interfaces/IAttachmentRepository'
import type { AttachmentMeta } from '@meet-ai/cli/types'
import type { ApiError } from '@meet-ai/domain'

export default class AttachmentRepository implements IAttachmentRepository {
  constructor(private readonly client: ApiClient) {}

  async listForMessage(
    roomId: string,
    messageId: string
  ): Promise<Result<AttachmentMeta[], ApiError>> {
    return Result.tryPromise({
      try: async () => {
        const res = await this.client.api.rooms[':id'].messages[':messageId'].attachments.$get({
          param: {
            id: roomId,
            messageId,
          },
        })
        if (!res.ok) throw await parseError(res)

        const data = await res.json()

        return data.map(mapAttachment)
      },
      catch: catchApiError,
    })
  }

  async download(attachmentId: string): Promise<Result<Response, ApiError>> {
    return Result.tryPromise({
      try: async () => {
        const res = await this.client.api.attachments[':id'].$get({ param: { id: attachmentId } })
        if (!res.ok) throw await parseError(res)

        return res
      },
      catch: catchApiError,
    })
  }
}
