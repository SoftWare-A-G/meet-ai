import type IRoomRepository from '@meet-ai/cli/domain/interfaces/IRoomRepository'
import type { Room } from '@meet-ai/cli/types'

export default class ListRooms {
  constructor(private readonly roomRepository: IRoomRepository) {}

  execute(): Promise<Room[]> {
    return this.roomRepository.list()
  }
}
