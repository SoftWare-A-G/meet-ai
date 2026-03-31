import type { Result } from 'better-result'
import type { CreateReviewResult, PlanReviewDecision } from '../entities/review'
import type { ReviewCreateError, ReviewPollError, TimeoutError } from '../entities/errors'

export interface IPlanReviewRepository {
  createPlanReview(
    roomId: string,
    planContent: string,
  ): Promise<Result<CreateReviewResult, ReviewCreateError>>

  getPlanReviewStatus(
    roomId: string,
    reviewId: string,
  ): Promise<Result<PlanReviewDecision, ReviewPollError | TimeoutError>>

  expirePlanReview(
    roomId: string,
    reviewId: string,
  ): Promise<Result<void, ReviewPollError>>
}
