import { Result } from 'better-result'
import { TaskUpsertError } from '@meet-ai/domain'
import type { ITaskRepository, TaskUpsertPayload } from '@meet-ai/domain'
import type { HookClient } from '@meet-ai/cli/lib/hooks/client'

export class HookTaskRepository implements ITaskRepository {
  constructor(private readonly client: HookClient) {}

  async upsertTask(
    roomId: string,
    payload: TaskUpsertPayload,
  ): Promise<Result<void, TaskUpsertError>> {
    try {
      const res = await this.client.api.rooms[':id'].tasks.upsert.$post({
        param: { id: roomId },
        json: payload,
      })
      if (!res.ok) {
        return Result.err(
          new TaskUpsertError({ message: `HTTP ${res.status}: ${res.statusText}` }),
        )
      }
      return Result.ok(undefined)
    } catch (error) {
      return Result.err(new TaskUpsertError({ message: String(error) }))
    }
  }
}
