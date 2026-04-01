import type { Result } from 'better-result'
import type { CreateReviewResult, PermissionReviewDecision } from '../entities/review'
import type { ReviewCreateError, ReviewPollError, TimeoutError } from '../entities/errors'

export interface IReviewRepository {
  createPermissionReview(
    roomId: string,
    toolName: string,
    toolInput: Record<string, unknown> | undefined,
    formattedContent: string,
  ): Promise<Result<CreateReviewResult, ReviewCreateError>>

  getPermissionReviewStatus(
    roomId: string,
    reviewId: string,
  ): Promise<Result<PermissionReviewDecision, ReviewPollError | TimeoutError>>

  expirePermissionReview(
    roomId: string,
    reviewId: string,
  ): Promise<Result<void, ReviewPollError>>
}
