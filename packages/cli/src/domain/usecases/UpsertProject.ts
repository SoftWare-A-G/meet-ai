import type { ApiError } from '@meet-ai/domain'
import type { Result } from 'better-result'
import type IProjectRepository from '@meet-ai/cli/domain/interfaces/IProjectRepository'

export default class UpsertProject {
  constructor(private readonly projectRepository: IProjectRepository) {}

  execute(id: string, name: string): Promise<Result<{ id: string; name: string }, ApiError>> {
    return this.projectRepository.upsert(id, name)
  }
}
