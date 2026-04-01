import { catchApiError, parseError, RETRY } from '@meet-ai/cli/domain/lib/api-errors'
import { mapMessage } from '@meet-ai/cli/domain/mappers/message'
import { Result } from 'better-result'
import type { ApiClient } from '@meet-ai/cli/domain/adapters/api-client'
import type IMessageRepository from '@meet-ai/cli/domain/interfaces/IMessageRepository'
import type {
  ListMessagesOptions,
  SendLogOptions,
} from '@meet-ai/cli/domain/interfaces/IMessageRepository'
import type { Message } from '@meet-ai/cli/types'
import type { ApiError } from '@meet-ai/domain'

export default class MessageRepository implements IMessageRepository {
  constructor(private readonly client: ApiClient) {}

  async send(
    roomId: string,
    sender: string,
    content: string,
    color?: string
  ): Promise<Result<Message, ApiError>> {
    return Result.tryPromise(
      {
        try: async () => {
          const res = await this.client.api.rooms[':id'].messages.$post({
            param: { id: roomId },
            json: { sender, content, sender_type: 'agent', ...(color && { color }) },
          })
          if (!res.ok) throw await parseError(res)

          const data = await res.json()

          return mapMessage(data)
        },
        catch: catchApiError,
      },
      RETRY
    )
  }

  async list(roomId: string, opts?: ListMessagesOptions): Promise<Result<Message[], ApiError>> {
    const query: Record<string, string> = {}
    if (opts?.after) query.after = opts.after
    if (opts?.exclude) query.exclude = opts.exclude
    if (opts?.senderType) query.sender_type = opts.senderType

    return Result.tryPromise({
      try: async () => {
        const res = await this.client.api.rooms[':id'].messages.$get({
          param: { id: roomId },
          query,
        })
        if (!res.ok) throw await parseError(res)

        const data = await res.json()

        return data.map(mapMessage)
      },
      catch: catchApiError,
    })
  }

  async sendLog(
    roomId: string,
    sender: string,
    content: string,
    opts?: SendLogOptions
  ): Promise<Result<Message, ApiError>> {
    return Result.tryPromise(
      {
        try: async () => {
          const res = await this.client.api.rooms[':id'].logs.$post({
            param: { id: roomId },
            json: {
              sender,
              content,
              ...(opts?.color && { color: opts.color }),
              ...(opts?.messageId && { message_id: opts.messageId }),
            },
          })
          if (!res.ok) throw await parseError(res)

          const data = await res.json()

          return mapMessage(data)
        },
        catch: catchApiError,
      },
      RETRY
    )
  }
}
