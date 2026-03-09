import type IProjectRepository from '@meet-ai/cli/domain/interfaces/IProjectRepository'

export default class UpsertProject {
  constructor(private readonly projectRepository: IProjectRepository) {}

  async execute(id: string, name: string) {
    return this.projectRepository.upsert(id, name)
  }
}
