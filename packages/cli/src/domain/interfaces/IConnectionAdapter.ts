import type { Message } from '@meet-ai/cli/types'

export interface ListenOptions {
  exclude?: string
  senderType?: string
  onMessage?: (msg: Message) => void
}

export interface LobbyOptions {
  onRoomCreated?: (id: string, name: string) => void
  onSpawnRequest?: (roomName: string) => void
  silent?: boolean
}

export default interface IConnectionAdapter {
  listen(roomId: string, opts?: ListenOptions): WebSocket
  listenLobby(opts?: LobbyOptions): WebSocket
  generateKey(): Promise<{ key: string; prefix: string }>
}
