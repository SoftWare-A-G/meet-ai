import { Result } from 'better-result'
import { PermissionRequestInputSchema } from '../entities/hooks'
import type { PermissionRequestInput } from '../entities/hooks'
import type { IReviewRepository } from '../repositories/IReviewRepository'
import type { IHookTransport } from '../adapters/IHookTransport'
import type { IRoomResolver } from '../services/IRoomResolver'
import type { HookOutput, ReviewStatus } from '../entities/review'
import { ParseError, ValidationError } from '../entities/errors'
import type {
  TimeoutError,
  ReviewCreateError,
  ReviewPollError,
  RoomResolveError,
} from '../entities/errors'

const EXCLUDED_TOOLS = ['ExitPlanMode', 'AskUserQuestion']

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
    const parsed = this.parsePermissionInput(rawInput)
    if (parsed.isErr()) return parsed

    const input = parsed.value

    // 2. Excluded tool check
    if (this.isExcludedTool(input.tool_name)) return Result.ok(null)

    // 3. Resolve room
    const roomResult = await this.roomResolver.findRoomForSession(
      input.session_id,
      input.transcript_path,
    )
    if (roomResult.isErr()) return roomResult

    const roomId = roomResult.value

    // 4. Format & create review
    const formattedContent = this.formatPermissionRequest(input.tool_name, input.tool_input)
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
    return this.resolveDecisionOutput(decisionResult.value.status, decisionResult.value.feedback)
  }

  private parsePermissionInput(
    raw: string,
  ): Result<PermissionRequestInput, ParseError | ValidationError> {
    const parsed = Result.try({
      try: () => JSON.parse(raw),
      catch: () => new ParseError({ message: 'Invalid JSON' }),
    })
    if (parsed.isErr()) return parsed

    const result = PermissionRequestInputSchema.safeParse(parsed.value)
    if (!result.success) {
      const issue = result.error.issues[0]
      const field = String(issue.path[0] ?? 'input')
      const message = issue.code === 'too_small' ? `${field} is required` : issue.message
      return Result.err(new ValidationError({ field, message }))
    }

    return Result.ok(result.data)
  }

  private isExcludedTool(toolName: string): boolean {
    return EXCLUDED_TOOLS.includes(toolName)
  }

  private formatPermissionRequest(
    toolName: string,
    toolInput?: Record<string, unknown>,
  ): string {
    let text = `**Permission request: ${toolName}**\n`

    if (toolInput) {
      const entries = Object.entries(toolInput)
      if (entries.length > 0) {
        for (const [key, value] of entries) {
          const valueStr = typeof value === 'string' ? value : JSON.stringify(value)
          const truncated = valueStr.length > 200 ? `${valueStr.slice(0, 200)}...` : valueStr
          text += `\n**${key}:** \`${truncated}\``
        }
      }
    }

    return text
  }

  private resolveDecisionOutput(
    status: ReviewStatus,
    feedback?: string | null,
  ): Result<HookOutput | null, never> {
    if (status === 'approved') {
      return Result.ok({
        hookSpecificOutput: {
          hookEventName: 'PermissionRequest',
          decision: { behavior: 'allow' },
        },
      })
    }
    if (status === 'denied') {
      return Result.ok({
        hookSpecificOutput: {
          hookEventName: 'PermissionRequest',
          decision: { behavior: 'deny', message: feedback || 'Permission denied by user.' },
        },
      })
    }
    return Result.ok(null)
  }
}
