import type { Message } from '@meet-ai/cli/types'
import type IHttpTransport from '@meet-ai/cli/domain/interfaces/IHttpTransport'
import type IMessageRepository from '@meet-ai/cli/domain/interfaces/IMessageRepository'
import type { ListMessagesOptions, SendLogOptions } from '@meet-ai/cli/domain/interfaces/IMessageRepository'

const RETRY = { retry: { maxRetries: 3, baseDelay: 1000 } }

export default class MessageRepository implements IMessageRepository {
  constructor(private readonly transport: IHttpTransport) {}

  async send(roomId: string, sender: string, content: string, color?: string): Promise<Message> {
    return this.transport.postJson<Message>(
      `/api/rooms/${roomId}/messages`,
      { sender, content, sender_type: 'agent', ...(color && { color }) },
      RETRY
    )
  }

  async list(roomId: string, opts?: ListMessagesOptions): Promise<Message[]> {
    const query: Record<string, string> = {}
    if (opts?.after) query.after = opts.after
    if (opts?.exclude) query.exclude = opts.exclude
    if (opts?.senderType) query.sender_type = opts.senderType

    return this.transport.getJson<Message[]>(`/api/rooms/${roomId}/messages`, { query })
  }

  async sendLog(roomId: string, sender: string, content: string, opts?: SendLogOptions): Promise<Message> {
    return this.transport.postJson<Message>(
      `/api/rooms/${roomId}/logs`,
      {
        sender,
        content,
        ...(opts?.color && { color: opts.color }),
        ...(opts?.messageId && { message_id: opts.messageId }),
      },
      RETRY
    )
  }
}
