import type IRoomRepository from '@meet-ai/cli/domain/interfaces/IRoomRepository'

export default class DeleteRoom {
  constructor(private readonly roomRepository: IRoomRepository) {}

  async execute(roomId: string) {
    return this.roomRepository.delete(roomId)
  }
}
