import type { Message } from '@meet-ai/cli/types'

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
  send(roomId: string, sender: string, content: string, color?: string): Promise<Message>
  list(roomId: string, opts?: ListMessagesOptions): Promise<Message[]>
  sendLog(roomId: string, sender: string, content: string, opts?: SendLogOptions): Promise<Message>
}
