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
    return Result.tryPromise({
      try: async () => {
        const res = await this.client.api.rooms[':id'].tasks.upsert.$post({
          param: { id: roomId },
          json: payload,
        })
        if (!res.ok) {
          throw new TaskUpsertError({ message: `HTTP ${res.status}: ${res.statusText}` })
        }
      },
      catch: (e) => e instanceof TaskUpsertError ? e : new TaskUpsertError({ message: String(e) }),
    })
  }
}
