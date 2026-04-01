import { catchApiError, parseError } from '@meet-ai/cli/domain/lib/api-errors'
import { Result } from 'better-result'
import type { ApiClient } from '@meet-ai/cli/domain/adapters/api-client'
import type IProjectRepository from '@meet-ai/cli/domain/interfaces/IProjectRepository'
import type { ApiError } from '@meet-ai/domain'

export default class ProjectRepository implements IProjectRepository {
  constructor(private readonly client: ApiClient) {}

  async find(id: string): Promise<Result<{ id: string; name: string } | null, ApiError>> {
    return Result.tryPromise({
      try: async () => {
        const res = await this.client.api.projects[':id'].$get({ param: { id } })
        if (res.status === 404) return null

        if (!res.ok) throw await parseError(res)

        return await res.json()
      },
      catch: catchApiError,
    })
  }

  async upsert(id: string, name: string): Promise<Result<{ id: string; name: string }, ApiError>> {
    return Result.tryPromise({
      try: async () => {
        const res = await this.client.api.projects.$post({ json: { id, name } })

        if (!res.ok) throw await parseError(res)

        return await res.json()
      },
      catch: catchApiError,
    })
  }
}
