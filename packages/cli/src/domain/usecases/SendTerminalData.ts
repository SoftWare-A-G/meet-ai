import type { ApiError } from '@meet-ai/domain'
import type { Result } from 'better-result'
import type IRoomRepository from '@meet-ai/cli/domain/interfaces/IRoomRepository'

export default class SendTerminalData {
  constructor(private readonly roomRepository: IRoomRepository) {}

  execute(roomId: string, data: string): Promise<Result<void, ApiError>> {
    return this.roomRepository.sendTerminalData(roomId, data)
  }
}
