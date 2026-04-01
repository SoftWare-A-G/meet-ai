import type { Room, ApiError } from '@meet-ai/domain'
import type { Result } from 'better-result'
import type IRoomRepository from '@meet-ai/cli/domain/interfaces/IRoomRepository'

export default class ListRooms {
  constructor(private readonly roomRepository: IRoomRepository) {}

  execute(): Promise<Result<Room[], ApiError>> {
    return this.roomRepository.list()
  }
}
