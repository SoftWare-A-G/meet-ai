import { Result } from 'better-result'
import { ParseError, ValidationError } from '../entities/errors'
import { PermissionRequestInputSchema } from '../entities/hooks'
import type { IHookTransport } from '../adapters/IHookTransport'
import type {
  TimeoutError,
  ReviewCreateError,
  ReviewPollError,
  RoomResolveError,
} from '../entities/errors'
import type { PermissionRequestInput } from '../entities/hooks'
import type { HookOutput, ReviewStatus } from '../entities/review'
import type { IReviewRepository } from '../repositories/IReviewRepository'
import type { IRoomResolver } from '../services/IRoomResolver'

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
    private readonly roomResolver: IRoomResolver
  ) {}

  async execute(
    rawInput: string
  ): Promise<Result<HookOutput | null, ProcessPermissionReviewError>> {
    return Result.gen(async function* (this: ProcessPermissionReview) {
      const input = yield* this.parsePermissionInput(rawInput)

      if (this.isExcludedTool(input.tool_name)) return Result.ok(null)

      const roomId = yield* Result.await(
        this.roomResolver.findRoomForSession(input.session_id, input.transcript_path)
      )
      const formattedContent = this.formatPermissionRequest(input.tool_name, input.tool_input)
      const review = yield* Result.await(
        this.reviewRepository.createPermissionReview(
          roomId,
          input.tool_name,
          input.tool_input,
          formattedContent
        )
      )

      const decision = yield* Result.await(
        (async () => {
          const result = await this.reviewRepository.getPermissionReviewStatus(roomId, review.id)
          if (result.isErr() && result.error._tag === 'TimeoutError') {
            await this.reviewRepository.expirePermissionReview(roomId, review.id)
            await this.hookTransport.sendTimeoutMessage(
              roomId,
              '_Permission request timed out — approve in terminal instead._',
              '#f97316'
            )
          }
          return result
        })()
      )

      return this.resolveDecisionOutput(decision.status, decision.feedback)
    }, this)
  }

  private parsePermissionInput(
    raw: string
  ): Result<PermissionRequestInput, ParseError | ValidationError> {
    return Result.gen(function* () {
      const parsed = yield* Result.try({
        try: () => JSON.parse(raw),
        catch: () => new ParseError({ message: 'Invalid JSON' }),
      })

      const result = PermissionRequestInputSchema.safeParse(parsed)
      if (!result.success) {
        const issue = result.error.issues[0]
        const field = String(issue.path[0] ?? 'input')
        const message = issue.code === 'too_small' ? `${field} is required` : issue.message
        return yield* Result.err(new ValidationError({ field, message }))
      }

      return Result.ok(result.data)
    })
  }

  private isExcludedTool(toolName: string): boolean {
    return EXCLUDED_TOOLS.includes(toolName)
  }

  private formatPermissionRequest(toolName: string, toolInput?: Record<string, unknown>): string {
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
    feedback?: string | null
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
