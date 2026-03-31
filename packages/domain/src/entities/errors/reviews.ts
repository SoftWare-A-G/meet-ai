import { TaggedError } from 'better-result'

export class ReviewCreateError extends TaggedError('ReviewCreateError')<{ message: string }>() {}
export class ReviewPollError extends TaggedError('ReviewPollError')<{ message: string }>() {}
export class RoomResolveError extends TaggedError('RoomResolveError')<{ message: string }>() {}
