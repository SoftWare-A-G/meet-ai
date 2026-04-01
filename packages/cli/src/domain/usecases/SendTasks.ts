import type { ApiError } from '@meet-ai/domain'
import type { Result } from 'better-result'
import type IRoomRepository from '@meet-ai/cli/domain/interfaces/IRoomRepository'

export default class SendTasks {
  constructor(private readonly roomRepository: IRoomRepository) {}

  execute(roomId: string, payload: string): Promise<Result<string, ApiError>> {
    return this.roomRepository.sendTasks(roomId, payload)
  }
}
