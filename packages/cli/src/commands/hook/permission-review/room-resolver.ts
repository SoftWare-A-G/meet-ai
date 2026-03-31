import { Result } from 'better-result'
import type { IRoomResolver } from '@meet-ai/domain'
import { RoomResolveError } from '@meet-ai/domain'
import { findRoomId } from '@meet-ai/cli/lib/hooks/find-room'

export class SessionRoomResolver implements IRoomResolver {
  constructor(private readonly teamsDir?: string) {}

  async findRoomForSession(
    sessionId: string,
    transcriptPath?: string,
  ): Promise<Result<string, RoomResolveError>> {
    const roomId = await findRoomId(sessionId, this.teamsDir, transcriptPath)
    if (!roomId) {
      return Result.err(new RoomResolveError({ message: 'No room found for session' }))
    }
    return Result.ok(roomId)
  }
}
