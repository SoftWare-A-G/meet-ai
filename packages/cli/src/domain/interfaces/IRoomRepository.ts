import type { Room, ApiError } from '@meet-ai/domain'
import type { Result } from 'better-result'

export default interface IRoomRepository {
  list(): Promise<Result<Room[], ApiError>>
  create(name: string, projectId?: string): Promise<Result<Room, ApiError>>
  update(
    roomId: string,
    fields: { name?: string; projectId?: string }
  ): Promise<Result<Room, ApiError>>
  delete(roomId: string): Promise<Result<void, ApiError>>
  sendTeamInfo(roomId: string, payload: string): Promise<Result<string, ApiError>>
  sendCommands(roomId: string, payload: string): Promise<Result<string, ApiError>>
  sendTasks(roomId: string, payload: string): Promise<Result<string, ApiError>>
  sendTerminalData(roomId: string, data: string): Promise<Result<void, ApiError>>
}
