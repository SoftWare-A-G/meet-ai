import { Result } from 'better-result'
import { PlanRequestInputSchema } from '../entities/hooks'
import type { PlanRequestInput } from '../entities/hooks'
import type { IPlanReviewRepository } from '../repositories/IPlanReviewRepository'
import type { IRoomResolver } from '../services/IRoomResolver'
import type { AllowedPrompt, HookOutput, PermissionMode, ReviewStatus } from '../entities/review'
import { ParseError, ValidationError } from '../entities/errors'
import type {
  TimeoutError,
  ReviewCreateError,
  ReviewPollError,
  RoomResolveError,
} from '../entities/errors'

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
    private readonly roomResolver: IRoomResolver,
  ) {}

  async execute(
    rawInput: string,
  ): Promise<Result<HookOutput | null, ProcessPlanReviewError>> {
    // 1. Parse & validate
    const parsed = this.parsePlanInput(rawInput)
    if (parsed.isErr()) return parsed

    const input = parsed.value

    // 2. Resolve room
    const roomResult = await this.roomResolver.findRoomForSession(
      input.session_id,
      input.transcript_path,
    )
    if (roomResult.isErr()) return roomResult

    const roomId = roomResult.value

    // 3. Extract plan content & create review
    const planContent = input.tool_input?.plan || PLAN_FALLBACK
    const reviewResult = await this.planReviewRepository.createPlanReview(
      roomId,
      planContent,
    )
    if (reviewResult.isErr()) return reviewResult

    const review = reviewResult.value

    // 4. Poll for decision
    const decisionResult = await this.planReviewRepository.getPlanReviewStatus(
      roomId,
      review.id,
    )
    if (decisionResult.isErr()) {
      if (decisionResult.error._tag === 'TimeoutError') {
        void await this.planReviewRepository.expirePlanReview(roomId, review.id)
      }
      return decisionResult
    }

    // 5. Resolve output
    return this.resolveDecisionOutput(
      decisionResult.value.status,
      decisionResult.value.feedback,
      decisionResult.value.permission_mode,
    )
  }

  private parsePlanInput(
    raw: string,
  ): Result<PlanRequestInput, ParseError | ValidationError> {
    const parsed = Result.try({
      try: () => JSON.parse(raw),
      catch: () => new ParseError({ message: 'Invalid JSON' }),
    })
    if (parsed.isErr()) return parsed

    const result = PlanRequestInputSchema.safeParse(parsed.value)
    if (!result.success) {
      const issue = result.error.issues[0]
      const field = String(issue.path[0] ?? 'input')
      const message = issue.code === 'too_small' ? `${field} is required` : issue.message
      return Result.err(new ValidationError({ field, message }))
    }

    return Result.ok(result.data)
  }

  private resolveDecisionOutput(
    status: ReviewStatus,
    feedback: string | null | undefined,
    permissionMode: PermissionMode,
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
