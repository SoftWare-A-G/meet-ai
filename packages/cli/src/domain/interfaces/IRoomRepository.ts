export default interface IRoomRepository {
  create(name: string): Promise<{ id: string; name: string }>
  delete(roomId: string): Promise<void>
  sendTeamInfo(roomId: string, payload: string): Promise<string>
  sendCommands(roomId: string, payload: string): Promise<string>
  sendTasks(roomId: string, payload: string): Promise<string>
  sendTerminalData(roomId: string, data: string): Promise<void>
}
