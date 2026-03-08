import type { Message } from '@meet-ai/cli/types'
import type { CodingAgentId } from '@meet-ai/cli/coding-agents'

export interface ListenOptions {
  exclude?: string
  senderType?: string
  onMessage?: (msg: Message) => void
}

export interface LobbyOptions {
  onRoomCreated?: (id: string, name: string) => void
  onSpawnRequest?: (request: { roomName: string; codingAgent: CodingAgentId }) => void
  silent?: boolean
}

export default interface IConnectionAdapter {
  listen(roomId: string, opts?: ListenOptions): WebSocket
  listenLobby(opts?: LobbyOptions): WebSocket
  generateKey(): Promise<{ key: string; prefix: string }>
}
