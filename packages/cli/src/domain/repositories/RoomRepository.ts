import type IHttpTransport from '@meet-ai/cli/domain/interfaces/IHttpTransport'
import type IRoomRepository from '@meet-ai/cli/domain/interfaces/IRoomRepository'
import type { Room } from '@meet-ai/cli/types'

const RETRY = { maxRetries: 3, baseDelay: 1000 }

export default class RoomRepository implements IRoomRepository {
  constructor(private readonly transport: IHttpTransport) {}

  async list(): Promise<Room[]> {
    return this.transport.getJson('/api/rooms')
  }

  async create(name: string, projectId?: string): Promise<Room> {
    const body: Record<string, string> = { name }
    if (projectId) body.project_id = projectId
    return this.transport.postJson('/api/rooms', body)
  }

  async update(roomId: string, fields: { name?: string; project_id?: string | null }): Promise<Room> {
    return this.transport.patchJson(`/api/rooms/${roomId}`, fields)
  }

  async delete(roomId: string): Promise<void> {
    return this.transport.del(`/api/rooms/${roomId}`)
  }

  async sendTeamInfo(roomId: string, payload: string): Promise<string> {
    return this.transport.postText(`/api/rooms/${roomId}/team-info`, JSON.parse(payload), {
      retry: RETRY,
    })
  }

  async sendCommands(roomId: string, payload: string): Promise<string> {
    return this.transport.postText(`/api/rooms/${roomId}/commands`, JSON.parse(payload), {
      retry: RETRY,
    })
  }

  async sendTasks(roomId: string, payload: string): Promise<string> {
    return this.transport.postText(`/api/rooms/${roomId}/tasks`, JSON.parse(payload), {
      retry: RETRY,
    })
  }

  async sendTerminalData(roomId: string, data: string): Promise<void> {
    try {
      await this.transport.postJson(`/api/rooms/${roomId}/terminal`, { data })
    } catch {
      // Silently ignore — terminal data is ephemeral
    }
  }
}
