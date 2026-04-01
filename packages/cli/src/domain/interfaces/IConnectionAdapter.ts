import type { Message } from '@meet-ai/cli/types'
import type { CodingAgentId } from '@meet-ai/cli/coding-agents'
import type { ApiError } from '@meet-ai/domain'
import type { Result } from 'better-result'

export interface ListenOptions {
  exclude?: string
  senderType?: string
  onMessage?: (msg: Message) => void
}

export interface LobbyOptions {
  onRoomCreated?: (id: string, name: string) => void
  onRoomDeleted?: (id: string) => void
  onSpawnRequest?: (request: { roomName: string; codingAgent: CodingAgentId }) => void
  silent?: boolean
}

export default interface IConnectionAdapter {
  listen(roomId: string, opts?: ListenOptions): WebSocket
  listenLobby(opts?: LobbyOptions): WebSocket
  generateKey(): Promise<Result<{ key: string; prefix: string }, ApiError>>
}
