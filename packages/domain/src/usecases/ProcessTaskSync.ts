import { Result } from 'better-result'
import { ParseError, ValidationError } from '../entities/errors'
import { TaskHookInputSchema } from '../entities/hooks'
import { TaskStatusSchema } from '../entities/tasks'
import type { RoomResolveError, TaskUpsertError } from '../entities/errors'
import type { TaskHookInput } from '../entities/hooks'
import type { TaskUpsertPayload } from '../entities/tasks'
import type { ITaskRepository } from '../repositories/ITaskRepository'
import type { IRoomResolver } from '../services/IRoomResolver'

const CLAUDE_STATUS_MAP: Record<string, string> = {
  open: 'pending',
  in_progress: 'in_progress',
  completed: 'completed',
  done: 'completed',
}

export type ProcessTaskSyncError = ParseError | ValidationError | RoomResolveError | TaskUpsertError

export default class ProcessTaskSync {
  constructor(
    private readonly taskRepository: ITaskRepository,
    private readonly roomResolver: IRoomResolver
  ) {}

  async execute(rawInput: string): Promise<Result<void, ProcessTaskSyncError>> {
    return Result.gen(async function* (this: ProcessTaskSync) {
      const input = yield* this.parseTaskInput(rawInput)
      const roomId = yield* Result.await(
        this.roomResolver.findRoomForSession(input.session_id, input.transcript_path)
      )
      const payload = this.buildPayload(input)
      yield* Result.await(this.taskRepository.upsertTask(roomId, payload))
      return Result.ok()
    }, this)
  }

  private parseTaskInput(raw: string): Result<TaskHookInput, ParseError | ValidationError> {
    return Result.gen(function* () {
      const parsed = yield* Result.try({
        try: () => JSON.parse(raw),
        catch: () => new ParseError({ message: 'Invalid JSON' }),
      })

      const result = TaskHookInputSchema.safeParse(parsed)
      if (!result.success) {
        const issue = result.error.issues[0]
        const field = String(issue.path[0] ?? 'input')
        const message = issue.code === 'too_small' ? `${field} is required` : issue.message
        return yield* Result.err(new ValidationError({ field, message }))
      }

      return Result.ok(result.data)
    })
  }

  private buildPayload(input: TaskHookInput): TaskUpsertPayload {
    if (input.tool_name === 'TaskCreate') {
      const payload: TaskUpsertPayload = {
        source: 'claude',
        source_id: input.tool_response.task.id,
        subject: input.tool_input.subject,
        status: 'pending',
        updated_by: 'claude',
      }
      if (input.tool_input.description) {
        payload.description = input.tool_input.description
      }
      return payload
    }

    // TaskUpdate
    const payload: TaskUpsertPayload = {
      source: 'claude',
      source_id: input.tool_response.taskId,
      updated_by: 'claude',
    }

    if (input.tool_input.subject) {
      payload.subject = input.tool_input.subject
    }
    if (input.tool_input.description) {
      payload.description = input.tool_input.description
    }
    if (input.tool_input.status) {
      payload.status = this.mapStatus(input.tool_input.status)
    }
    if (input.tool_input.owner !== undefined) {
      payload.assignee = input.tool_input.owner
    }

    return payload
  }

  private mapStatus(status: string): TaskUpsertPayload['status'] {
    const mapped = CLAUDE_STATUS_MAP[status]
    if (mapped) {
      const result = TaskStatusSchema.safeParse(mapped)
      return result.success ? result.data : undefined
    }
    const result = TaskStatusSchema.safeParse(status)
    return result.success ? result.data : undefined
  }
}
