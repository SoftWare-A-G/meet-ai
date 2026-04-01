import { Result } from 'better-result'
import { TaskHookInputSchema } from '../entities/hooks'
import type { TaskHookInput } from '../entities/hooks'
import { TaskStatusSchema } from '../entities/tasks'
import type { TaskUpsertPayload } from '../entities/tasks'
import type { ITaskRepository } from '../repositories/ITaskRepository'
import type { IRoomResolver } from '../services/IRoomResolver'
import { ParseError, ValidationError } from '../entities/errors'
import type { RoomResolveError, TaskUpsertError } from '../entities/errors'

const CLAUDE_STATUS_MAP: Record<string, string> = {
  open: 'pending',
  in_progress: 'in_progress',
  completed: 'completed',
  done: 'completed',
}

export type ProcessTaskSyncError =
  | ParseError
  | ValidationError
  | RoomResolveError
  | TaskUpsertError

export default class ProcessTaskSync {
  constructor(
    private readonly taskRepository: ITaskRepository,
    private readonly roomResolver: IRoomResolver,
  ) {}

  async execute(
    rawInput: string,
  ): Promise<Result<void, ProcessTaskSyncError>> {
    // 1. Parse & validate
    const parsed = this.parseTaskInput(rawInput)
    if (parsed.isErr()) return parsed

    const input = parsed.value

    // 2. Resolve room
    const roomResult = await this.roomResolver.findRoomForSession(
      input.session_id,
      input.transcript_path,
    )
    if (roomResult.isErr()) return roomResult

    const roomId = roomResult.value

    // 3. Build payload
    const payload = this.buildPayload(input)

    // 4. Upsert
    return this.taskRepository.upsertTask(roomId, payload)
  }

  private parseTaskInput(
    raw: string,
  ): Result<TaskHookInput, ParseError | ValidationError> {
    const parsed = Result.try({
      try: () => JSON.parse(raw),
      catch: () => new ParseError({ message: 'Invalid JSON' }),
    })
    if (parsed.isErr()) return parsed

    const result = TaskHookInputSchema.safeParse(parsed.value)
    if (!result.success) {
      const issue = result.error.issues[0]
      const field = String(issue.path[0] ?? 'input')
      const message = issue.code === 'too_small' ? `${field} is required` : issue.message
      return Result.err(new ValidationError({ field, message }))
    }

    return Result.ok(result.data)
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
