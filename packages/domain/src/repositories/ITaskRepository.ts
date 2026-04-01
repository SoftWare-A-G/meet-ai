import type { Result } from 'better-result'
import type { TaskUpsertPayload } from '../entities/tasks'
import type { TaskUpsertError } from '../entities/errors'

export interface ITaskRepository {
  upsertTask(roomId: string, payload: TaskUpsertPayload): Promise<Result<void, TaskUpsertError>>
}
