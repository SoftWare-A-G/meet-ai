import type IRoomRepository from '@meet-ai/cli/domain/interfaces/IRoomRepository'

export default class CreateRoom {
  constructor(private readonly roomRepository: IRoomRepository) {}

  async execute(name: string) {
    return this.roomRepository.create(name)
  }
}
