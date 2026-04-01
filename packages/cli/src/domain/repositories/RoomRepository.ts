import { catchApiError, parseError, RETRY } from '@meet-ai/cli/domain/lib/api-errors'
import { mapRoom } from '@meet-ai/cli/domain/mappers/room'
import { ApiError } from '@meet-ai/domain'
import { Result } from 'better-result'
import type { ApiClient } from '@meet-ai/cli/domain/adapters/api-client'
import type IRoomRepository from '@meet-ai/cli/domain/interfaces/IRoomRepository'
import type { Room } from '@meet-ai/domain'

export default class RoomRepository implements IRoomRepository {
  constructor(private readonly client: ApiClient) {}

  async list(): Promise<Result<Room[], ApiError>> {
    return Result.tryPromise({
      try: async () => {
        const res = await this.client.api.rooms.$get()

        if (!res.ok) throw await parseError(res)

        const data = await res.json()

        return data.map(mapRoom)
      },
      catch: catchApiError,
    })
  }

  async create(name: string, projectId?: string): Promise<Result<Room, ApiError>> {
    return Result.tryPromise({
      try: async () => {
        const res = await this.client.api.rooms.$post({ json: { name, project_id: projectId } })

        if (!res.ok) throw await parseError(res)

        const data = await res.json()

        return mapRoom(data)
      },
      catch: catchApiError,
    })
  }

  async update(
    roomId: string,
    fields: { name?: string; projectId?: string }
  ): Promise<Result<Room, ApiError>> {
    return Result.tryPromise({
      try: async () => {
        const res = await this.client.api.rooms[':id'].$patch({
          param: { id: roomId },
          json: { name: fields.name, project_id: fields.projectId },
        })

        if (!res.ok) throw await parseError(res)

        const data = await res.json()

        return mapRoom(data)
      },
      catch: catchApiError,
    })
  }

  async delete(roomId: string): Promise<Result<void, ApiError>> {
    return Result.tryPromise({
      try: async () => {
        const res = await this.client.api.rooms[':id'].$delete({ param: { id: roomId } })
        if (!res.ok) throw await parseError(res)
      },
      catch: catchApiError,
    })
  }

  async sendTeamInfo(roomId: string, payload: string): Promise<Result<string, ApiError>> {
    const parseResult = Result.try({
      try: () => JSON.parse(payload),
      catch: e => new ApiError({ status: 0, message: `Invalid JSON payload: ${e}` }),
    })

    if (parseResult.isErr()) return parseResult

    return Result.tryPromise(
      {
        try: async () => {
          const res = await this.client.api.rooms[':id']['team-info'].$post({
            param: { id: roomId },
            json: parseResult.value,
          })

          if (!res.ok) throw await parseError(res)

          return await res.text()
        },
        catch: catchApiError,
      },
      RETRY
    )
  }

  async sendCommands(roomId: string, payload: string): Promise<Result<string, ApiError>> {
    const parseResult = Result.try({
      try: () => JSON.parse(payload),
      catch: e => new ApiError({ status: 0, message: `Invalid JSON payload: ${e}` }),
    })

    if (parseResult.isErr()) return parseResult

    return Result.tryPromise(
      {
        try: async () => {
          const res = await this.client.api.rooms[':id'].commands.$post({
            param: { id: roomId },
            json: parseResult.value,
          })

          if (!res.ok) throw await parseError(res)

          return await res.text()
        },
        catch: catchApiError,
      },
      RETRY
    )
  }

  async sendTasks(roomId: string, payload: string): Promise<Result<string, ApiError>> {
    const parseResult = Result.try({
      try: () => JSON.parse(payload),
      catch: e => new ApiError({ status: 0, message: `Invalid JSON payload: ${e}` }),
    })

    if (parseResult.isErr()) return parseResult

    return Result.tryPromise(
      {
        try: async () => {
          const res = await this.client.api.rooms[':id'].tasks.$post({
            param: { id: roomId },
            json: parseResult.value,
          })

          if (!res.ok) throw await parseError(res)

          return await res.text()
        },
        catch: catchApiError,
      },
      RETRY
    )
  }

  async sendTerminalData(roomId: string, data: string): Promise<Result<void, ApiError>> {
    return Result.tryPromise({
      try: async () => {
        const res = await this.client.api.rooms[':id'].terminal.$post({
          param: { id: roomId },
          json: { data },
        })

        if (!res.ok) throw await parseError(res)
      },
      catch: catchApiError,
    })
  }
}
