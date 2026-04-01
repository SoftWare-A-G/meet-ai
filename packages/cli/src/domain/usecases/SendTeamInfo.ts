import type { ApiError } from '@meet-ai/domain'
import type { Result } from 'better-result'
import type IRoomRepository from '@meet-ai/cli/domain/interfaces/IRoomRepository'

export default class SendTeamInfo {
  constructor(private readonly roomRepository: IRoomRepository) {}

  execute(roomId: string, payload: string): Promise<Result<string, ApiError>> {
    return this.roomRepository.sendTeamInfo(roomId, payload)
  }
}
