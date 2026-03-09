import type IRoomRepository from '@meet-ai/cli/domain/interfaces/IRoomRepository'

export default class UpdateRoom {
  constructor(private readonly roomRepository: IRoomRepository) {}

  async execute(roomId: string, fields: { name?: string; project_id?: string | null }) {
    return this.roomRepository.update(roomId, fields)
  }
}
