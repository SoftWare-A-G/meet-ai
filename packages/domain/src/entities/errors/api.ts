import { TaggedError } from 'better-result'

export class ApiError extends TaggedError('ApiError')<{ status: number; message: string }>() {}
