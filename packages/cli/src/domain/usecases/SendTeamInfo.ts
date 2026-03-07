import type IRoomRepository from '@meet-ai/cli/domain/interfaces/IRoomRepository'

export default class SendTeamInfo {
  constructor(private readonly roomRepository: IRoomRepository) {}

  async execute(roomId: string, payload: string) {
    return this.roomRepository.sendTeamInfo(roomId, payload)
  }
}
