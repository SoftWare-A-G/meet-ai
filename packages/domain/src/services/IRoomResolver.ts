import type { Result } from 'better-result'
import type { RoomResolveError } from '../entities/errors'

export interface IRoomResolver {
  findRoomForSession(
    sessionId: string,
    transcriptPath?: string,
  ): Promise<Result<string, RoomResolveError>>
}
