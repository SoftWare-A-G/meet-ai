import { Result } from 'better-result'
import type { IReviewRepository } from '../repositories/IReviewRepository'
import type { IHookTransport } from '../adapters/IHookTransport'
import type { IRoomResolver } from '../services/IRoomResolver'
import type { HookOutput } from '../entities/review'
import type {
  ParseError,
  ValidationError,
  TimeoutError,
  ReviewCreateError,
  ReviewPollError,
  RoomResolveError,
} from '../entities/errors'
import {
  parsePermissionInput,
  isExcludedTool,
  formatPermissionRequest,
  resolveDecisionOutput,
} from './permission-review-helpers'

export type ProcessPermissionReviewError =
  | ParseError
  | ValidationError
  | RoomResolveError
  | ReviewCreateError
  | ReviewPollError
  | TimeoutError

export default class ProcessPermissionReview {
  constructor(
    private readonly reviewRepository: IReviewRepository,
    private readonly hookTransport: IHookTransport,
    private readonly roomResolver: IRoomResolver,
  ) {}

  async execute(
    rawInput: string,
  ): Promise<Result<HookOutput | null, ProcessPermissionReviewError>> {
    // 1. Parse & validate
    const parsed = parsePermissionInput(rawInput)
    if (parsed.isErr()) return parsed

    const input = parsed.value

    // 2. Excluded tool check
    if (isExcludedTool(input.tool_name)) return Result.ok(null)

    // 3. Resolve room
    const roomResult = await this.roomResolver.findRoomForSession(
      input.session_id,
      input.transcript_path,
    )
    if (roomResult.isErr()) return roomResult

    const roomId = roomResult.value

    // 4. Format & create review
    const formattedContent = formatPermissionRequest(input.tool_name, input.tool_input)
    const toolInputJson = input.tool_input ? JSON.stringify(input.tool_input) : undefined
    const reviewResult = await this.reviewRepository.createPermissionReview(
      roomId,
      input.tool_name,
      toolInputJson,
      formattedContent,
    )
    if (reviewResult.isErr()) return reviewResult

    const review = reviewResult.value

    // 5. Poll for decision
    const decisionResult = await this.reviewRepository.getPermissionReviewStatus(
      roomId,
      review.id,
    )
    if (decisionResult.isErr()) {
      // Only run cleanup on actual timeout — not on 404s or other poll failures
      if (decisionResult.error._tag === 'TimeoutError') {
        void await this.reviewRepository.expirePermissionReview(roomId, review.id)
        void await this.hookTransport.sendTimeoutMessage(roomId)
      }
      return decisionResult
    }

    // 6. Resolve output
    return resolveDecisionOutput(decisionResult.value.status, decisionResult.value.feedback)
  }
}
