import type IRoomRepository from '@meet-ai/cli/domain/interfaces/IRoomRepository'

export default class SendTerminalData {
  constructor(private readonly roomRepository: IRoomRepository) {}

  async execute(roomId: string, data: string) {
    return this.roomRepository.sendTerminalData(roomId, data)
  }
}
