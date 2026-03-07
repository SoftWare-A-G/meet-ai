import type IRoomRepository from '@meet-ai/cli/domain/interfaces/IRoomRepository'

export default class SendCommands {
  constructor(private readonly roomRepository: IRoomRepository) {}

  async execute(roomId: string, payload: string) {
    return this.roomRepository.sendCommands(roomId, payload)
  }
}
