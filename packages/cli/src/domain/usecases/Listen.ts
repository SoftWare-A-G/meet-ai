import type IConnectionAdapter from '@meet-ai/cli/domain/interfaces/IConnectionAdapter'
import type { ListenOptions } from '@meet-ai/cli/domain/interfaces/IConnectionAdapter'
import type IMessageRepository from '@meet-ai/cli/domain/interfaces/IMessageRepository'

export default class Listen {
  constructor(
    private readonly connectionAdapter: IConnectionAdapter,
    private readonly messageRepository: IMessageRepository,
  ) {}

  execute(roomId: string, opts?: ListenOptions) {
    return this.connectionAdapter.listen(roomId, opts)
  }
}
