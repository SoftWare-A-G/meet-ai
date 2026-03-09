import type IHttpTransport from '@meet-ai/cli/domain/interfaces/IHttpTransport'
import type IProjectRepository from '@meet-ai/cli/domain/interfaces/IProjectRepository'

export default class ProjectRepository implements IProjectRepository {
  constructor(private readonly transport: IHttpTransport) {}

  async find(id: string): Promise<{ id: string; name: string } | null> {
    try {
      return await this.transport.getJson(`/api/projects/${id}`)
    } catch {
      return null
    }
  }

  async upsert(id: string, name: string): Promise<{ id: string; name: string }> {
    return this.transport.postJson('/api/projects', { id, name })
  }
}
