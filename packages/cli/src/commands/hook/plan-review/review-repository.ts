import {
  ReviewCreateError,
  ReviewPollError,
  TimeoutError,
  PermissionModeSchema,
} from '@meet-ai/domain'
import { Result } from 'better-result'
import type { HookClient } from '@meet-ai/cli/lib/hooks/client'
import type { IPlanReviewRepository, CreateReviewResult, PlanReviewDecision } from '@meet-ai/domain'

const POLL_INTERVAL_MS = 2000
const POLL_TIMEOUT_MS = 2147483 // 3 weeks 3 days 20 hours 31 min 23 s

export class HookPlanReviewRepository implements IPlanReviewRepository {
  constructor(
    private readonly client: HookClient,
    private readonly pollInterval = POLL_INTERVAL_MS,
    private readonly pollTimeout = POLL_TIMEOUT_MS
  ) {}

  async createPlanReview(
    roomId: string,
    planContent: string
  ): Promise<Result<CreateReviewResult, ReviewCreateError>> {
    try {
      const res = await this.client.api.rooms[':id']['plan-reviews'].$post({
        param: { id: roomId },
        json: { plan_content: planContent },
      })
      if (!res.ok) {
        const body = await res.json()
        return Result.err(new ReviewCreateError({ message: `HTTP ${res.status}: ${body.error}` }))
      }
      const json = await res.json()
      return Result.ok(json)
    } catch (error) {
      return Result.err(new ReviewCreateError({ message: String(error) }))
    }
  }

  async getPlanReviewStatus(
    roomId: string,
    reviewId: string
  ): Promise<Result<PlanReviewDecision, ReviewPollError | TimeoutError>> {
    const deadline = Date.now() + this.pollTimeout
    let sawPending = false
    while (Date.now() < deadline) {
      try {
        const res = await this.client.api.rooms[':id']['plan-reviews'][':reviewId'].$get({
          param: { id: roomId, reviewId },
        })
        if (!res.ok) {
          const body = await res.json()
          return Result.err(new ReviewPollError({ message: `HTTP ${res.status}: ${body.error}` }))
        }
        const json = await res.json()
        if (json.status !== 'pending') {
          const modeResult = PermissionModeSchema.safeParse(json.permission_mode)
          return Result.ok({
            ...json,
            permission_mode: modeResult.success ? modeResult.data : 'default',
          })
        }
        sawPending = true
      } catch (error) {
        process.stderr.write(`[plan-review] poll error: ${error}\n`)
      }
      await new Promise(resolve => setTimeout(resolve, this.pollInterval))
    }
    if (sawPending) {
      return Result.err(new TimeoutError({ message: 'Timed out waiting for decision' }))
    }
    return Result.err(new ReviewPollError({ message: 'Poll failed — never received a response' }))
  }

  async expirePlanReview(roomId: string, reviewId: string): Promise<Result<void, ReviewPollError>> {
    try {
      const res = await this.client.api.rooms[':id']['plan-reviews'][':reviewId'].expire.$post({
        param: { id: roomId, reviewId },
      })
      if (!res.ok) {
        const body = await res.json()
        return Result.err(new ReviewPollError({ message: `HTTP ${res.status}: ${body.error}` }))
      }
      return Result.ok(undefined)
    } catch (error) {
      return Result.err(new ReviewPollError({ message: String(error) }))
    }
  }
}
