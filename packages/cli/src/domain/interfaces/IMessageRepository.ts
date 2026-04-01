import type { Message } from '@meet-ai/cli/types'
import type { ApiError } from '@meet-ai/domain'
import type { Result } from 'better-result'

export interface ListMessagesOptions {
  after?: string
  exclude?: string
  senderType?: string
}

export interface SendLogOptions {
  color?: string
  messageId?: string
}

export default interface IMessageRepository {
  send(roomId: string, sender: string, content: string, color?: string): Promise<Result<Message, ApiError>>
  list(roomId: string, opts?: ListMessagesOptions): Promise<Result<Message[], ApiError>>
  sendLog(roomId: string, sender: string, content: string, opts?: SendLogOptions): Promise<Result<Message, ApiError>>
}
