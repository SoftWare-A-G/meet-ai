import { Result } from 'better-result'
import { ParseError, ValidationError } from '../entities/errors'
import { PlanRequestInputSchema } from '../entities/hooks'
import type {
  TimeoutError,
  ReviewCreateError,
  ReviewPollError,
  RoomResolveError,
} from '../entities/errors'
import type { PlanRequestInput } from '../entities/hooks'
import type { AllowedPrompt, HookOutput, PermissionMode, ReviewStatus } from '../entities/review'
import type { IPlanReviewRepository } from '../repositories/IPlanReviewRepository'
import type { IRoomResolver } from '../services/IRoomResolver'

const PLAN_FALLBACK = '_Agent requested to exit plan mode without a plan._'

export type ProcessPlanReviewError =
  | ParseError
  | ValidationError
  | RoomResolveError
  | ReviewCreateError
  | ReviewPollError
  | TimeoutError

export default class ProcessPlanReview {
  constructor(
    private readonly planReviewRepository: IPlanReviewRepository,
    private readonly roomResolver: IRoomResolver
  ) {}

  async execute(rawInput: string): Promise<Result<HookOutput | null, ProcessPlanReviewError>> {
    return Result.gen(async function* (this: ProcessPlanReview) {
      const input = yield* this.parsePlanInput(rawInput)
      const roomId = yield* Result.await(
        this.roomResolver.findRoomForSession(input.session_id, input.transcript_path)
      )
      const planContent = input.tool_input?.plan || PLAN_FALLBACK
      const review = yield* Result.await(
        this.planReviewRepository.createPlanReview(roomId, planContent)
      )

      const decision = yield* Result.await(
        (async () => {
          const result = await this.planReviewRepository.getPlanReviewStatus(roomId, review.id)
          if (result.isErr() && result.error._tag === 'TimeoutError') {
            await this.planReviewRepository.expirePlanReview(roomId, review.id)
          }
          return result
        })()
      )

      return this.resolveDecisionOutput(
        decision.status,
        decision.feedback,
        decision.permission_mode
      )
    }, this)
  }

  private parsePlanInput(raw: string): Result<PlanRequestInput, ParseError | ValidationError> {
    return Result.gen(function* () {
      const parsed = yield* Result.try({
        try: () => JSON.parse(raw),
        catch: () => new ParseError({ message: 'Invalid JSON' }),
      })

      const result = PlanRequestInputSchema.safeParse(parsed)
      if (!result.success) {
        const issue = result.error.issues[0]
        const field = String(issue.path[0] ?? 'input')
        const message = issue.code === 'too_small' ? `${field} is required` : issue.message
        return yield* Result.err(new ValidationError({ field, message }))
      }

      return Result.ok(result.data)
    })
  }

  private resolveDecisionOutput(
    status: ReviewStatus,
    feedback: string | null | undefined,
    permissionMode: PermissionMode
  ): Result<HookOutput | null, never> {
    if (status === 'approved') {
      const allowedPrompts = this.getPromptsByMode(permissionMode)
      return Result.ok({
        hookSpecificOutput: {
          hookEventName: 'PermissionRequest',
          decision: {
            behavior: 'allow',
            ...(allowedPrompts ? { allowedPrompts } : {}),
          },
        },
      })
    }

    if (status === 'denied') {
      return Result.ok({
        hookSpecificOutput: {
          hookEventName: 'PermissionRequest',
          decision: {
            behavior: 'deny',
            message: feedback || 'Plan was rejected. Please revise the plan based on the feedback.',
          },
        },
      })
    }

    // expired
    return Result.ok({
      hookSpecificOutput: {
        hookEventName: 'PermissionRequest',
        decision: {
          behavior: 'deny',
          message: feedback || 'Plan was dismissed. Please revise the plan or ask for guidance.',
        },
      },
    })
  }

  private getPromptsByMode(mode: PermissionMode): AllowedPrompt[] | undefined {
    if (mode === 'acceptEdits') {
      return [
        { tool: 'Bash', prompt: 'install dependencies' },
        { tool: 'Bash', prompt: 'run tests' },
        { tool: 'Bash', prompt: 'run build' },
        { tool: 'Bash', prompt: 'run typecheck' },
        { tool: 'Bash', prompt: 'run linter' },
      ]
    }

    if (mode === 'bypassPermissions') {
      return [{ tool: 'Bash', prompt: 'run any command' }]
    }

    return undefined
  }
}
