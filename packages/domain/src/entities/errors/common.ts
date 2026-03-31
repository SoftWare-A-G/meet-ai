import { TaggedError } from 'better-result'

export class ParseError extends TaggedError('ParseError')<{ message: string }>() {}
export class ValidationError extends TaggedError('ValidationError')<{ field: string; message: string }>() {}
export class TimeoutError extends TaggedError('TimeoutError')<{ message: string }>() {}
export class NotifyError extends TaggedError('NotifyError')<{ message: string }>() {}
