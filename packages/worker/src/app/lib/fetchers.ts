import { getApiClient } from './api-client'
import type { ApiClient } from './api-client'
import type { InferRequestType, InferResponseType } from 'hono/client'

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

// Inferred response types from hono/client
export type RoomsResponse = InferResponseType<ApiClient['api']['rooms']['$get'], 200>
export type ProjectsResponse = InferResponseType<ApiClient['api']['projects']['$get'], 200>
export type RoomResponse = InferResponseType<ApiClient['api']['rooms'][':id']['$patch'], 200>
export type ProjectResponse = InferResponseType<ApiClient['api']['projects'][':id']['$patch'], 200>
export type TasksResponse = InferResponseType<ApiClient['api']['rooms'][':id']['tasks']['$get'], 200>
export type TaskItem = TasksResponse['tasks'][number]
export type CreateTaskResponse = InferResponseType<ApiClient['api']['rooms'][':id']['tasks']['create']['$post'], 201>
export type UpdateTaskResponse = InferResponseType<ApiClient['api']['rooms'][':id']['tasks'][':taskId']['$patch'], 200>

// Inferred request types from hono/client
export type PatchRoomInput = InferRequestType<ApiClient['api']['rooms'][':id']['$patch']>
export type DeleteRoomInput = InferRequestType<ApiClient['api']['rooms'][':id']['$delete']>
export type PatchProjectInput = InferRequestType<ApiClient['api']['projects'][':id']['$patch']>
export type CreateTaskInput = InferRequestType<ApiClient['api']['rooms'][':id']['tasks']['create']['$post']>
export type UpdateTaskInput = InferRequestType<ApiClient['api']['rooms'][':id']['tasks'][':taskId']['$patch']>
export type DeleteTaskInput = InferRequestType<ApiClient['api']['rooms'][':id']['tasks'][':taskId']['$delete']>

export async function fetchRooms() {
  const res = await getApiClient().api.rooms.$get()
  if (!res.ok) throw new ApiError(res.status, await res.text())
  return res.json()
}

export async function fetchProjects() {
  const res = await getApiClient().api.projects.$get()
  if (!res.ok) throw new ApiError(res.status, await res.text())
  return res.json()
}

export async function patchRoom(input: PatchRoomInput) {
  const res = await getApiClient().api.rooms[':id'].$patch(input)
  if (!res.ok) throw new ApiError(res.status, await res.text())
  return res.json()
}

export async function deleteRoom(input: DeleteRoomInput) {
  const res = await getApiClient().api.rooms[':id'].$delete(input)
  if (!res.ok) throw new ApiError(res.status, await res.text())
}

export async function patchProject(input: PatchProjectInput) {
  const res = await getApiClient().api.projects[':id'].$patch(input)
  if (!res.ok) throw new ApiError(res.status, await res.text())
  return res.json()
}

export async function fetchTasks(roomId: string) {
  const res = await getApiClient().api.rooms[':id'].tasks.$get({ param: { id: roomId } })
  if (!res.ok) throw new ApiError(res.status, await res.text())
  return res.json()
}

export async function createTask(input: CreateTaskInput) {
  const res = await getApiClient().api.rooms[':id'].tasks.create.$post(input)
  if (!res.ok) throw new ApiError(res.status, await res.text())
  return res.json()
}

export async function updateTask(input: UpdateTaskInput) {
  const res = await getApiClient().api.rooms[':id'].tasks[':taskId'].$patch(input)
  if (!res.ok) throw new ApiError(res.status, await res.text())
  return res.json()
}

export async function deleteTask(input: DeleteTaskInput) {
  const res = await getApiClient().api.rooms[':id'].tasks[':taskId'].$delete(input)
  if (!res.ok) throw new ApiError(res.status, await res.text())
}

export type AttachmentCountsResponse = InferResponseType<ApiClient['api']['rooms'][':id']['attachment-counts']['$get'], 200>
export type TeamInfoResponse = InferResponseType<ApiClient['api']['rooms'][':id']['team-info']['$get'], 200>

// Command types inferred from POST /api/rooms/:id/commands
type CommandsPostInput = InferRequestType<ApiClient['api']['rooms'][':id']['commands']['$post']>
export type CommandItem = CommandsPostInput['json']['commands'][number]
export type CommandsInfo = { type: 'commands_info'; commands: CommandItem[] }

export async function fetchAttachmentCounts(roomId: string) {
  const res = await getApiClient().api.rooms[':id']['attachment-counts'].$get({ param: { id: roomId } })
  if (!res.ok) throw new ApiError(res.status, await res.text())
  return res.json()
}

export async function fetchTeamInfo(roomId: string) {
  const res = await getApiClient().api.rooms[':id']['team-info'].$get({ param: { id: roomId } })
  if (!res.ok) throw new ApiError(res.status, await res.text())
  return res.json()
}
