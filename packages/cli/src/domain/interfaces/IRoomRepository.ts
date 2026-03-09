import type { Room } from '@meet-ai/cli/types'

export default interface IRoomRepository {
  list(): Promise<Room[]>

  create(name: string, projectId?: string): Promise<Room>
  update(roomId: string, fields: { name?: string; project_id?: string | null }): Promise<Room>
  delete(roomId: string): Promise<void>
  sendTeamInfo(roomId: string, payload: string): Promise<string>
  sendCommands(roomId: string, payload: string): Promise<string>
  sendTasks(roomId: string, payload: string): Promise<string>
  sendTerminalData(roomId: string, data: string): Promise<void>
}
