import type { ApiClient } from '@meet-ai/cli/domain/adapters/api-client'
import type { Message } from '@meet-ai/cli/types'
import type { InferResponseType } from 'hono/client'

type MessageListResponse = InferResponseType<
  ApiClient['api']['rooms'][':id']['messages']['$get'],
  200
>

// Pick only the fields mapMessage uses; sender_type is Partial because log responses omit it
type WireMessage = Pick<
  MessageListResponse[number],
  'id' | 'room_id' | 'sender' | 'content' | 'color'
> &
  Partial<Pick<MessageListResponse[number], 'sender_type'>>

export function mapMessage(raw: WireMessage): Message {
  return {
    id: raw.id,
    roomId: raw.room_id,
    sender: raw.sender,
    sender_type: raw.sender_type ?? 'agent',
    content: raw.content,
    ...(raw.color && { color: raw.color }),
  }
}
