import { TaggedError } from 'better-result'

export class TaskUpsertError extends TaggedError('TaskUpsertError')<{ message: string }>() {}
