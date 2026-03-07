import type IConnectionAdapter from '@meet-ai/cli/domain/interfaces/IConnectionAdapter'
import type { LobbyOptions } from '@meet-ai/cli/domain/interfaces/IConnectionAdapter'

export default class ListenLobby {
  constructor(private readonly connectionAdapter: IConnectionAdapter) {}

  execute(opts?: LobbyOptions) {
    return this.connectionAdapter.listenLobby(opts)
  }
}
