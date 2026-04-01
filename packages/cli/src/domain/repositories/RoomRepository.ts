import type IHttpTransport from '@meet-ai/cli/domain/interfaces/IHttpTransport'
import type IRoomRepository from '@meet-ai/cli/domain/interfaces/IRoomRepository'
import type { Room } from '@meet-ai/domain'

type WireRoom = { id: string; name: string; project_id: string | null; created_at: string }

function mapRoom(raw: WireRoom): Room {
  return { id: raw.id, name: raw.name, projectId: raw.project_id, createdAt: raw.created_at }
}

const RETRY = { maxRetries: 3, baseDelay: 1000 }

export default class RoomRepository implements IRoomRepository {
  constructor(private readonly transport: IHttpTransport) {}

  async list(): Promise<Room[]> {
    const raw = await this.transport.getJson<WireRoom[]>('/api/rooms')
    return raw.map(mapRoom)
  }

  async create(name: string, projectId?: string): Promise<Room> {
    const body: Record<string, string> = { name }
    if (projectId) body.project_id = projectId
    const raw = await this.transport.postJson<WireRoom>('/api/rooms', body)
    return mapRoom(raw)
  }

  async update(roomId: string, fields: { name?: string; projectId?: string }): Promise<Room> {
    const wireFields: Record<string, unknown> = {}
    if (fields.name !== undefined) wireFields.name = fields.name
    if (fields.projectId) wireFields.project_id = fields.projectId
    const raw = await this.transport.patchJson<WireRoom>(`/api/rooms/${roomId}`, wireFields)
    return mapRoom(raw)
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
