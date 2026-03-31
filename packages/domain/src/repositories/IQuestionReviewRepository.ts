import type { Result } from 'better-result'
import type { CreateReviewResult, QuestionReviewAnswer } from '../entities/review'
import type { ReviewCreateError, ReviewPollError, TimeoutError } from '../entities/errors'
import type { QuestionItem } from '../entities/hooks'

export interface IQuestionReviewRepository {
  createQuestionReview(
    roomId: string,
    questions: QuestionItem[],
    formattedContent: string,
  ): Promise<Result<CreateReviewResult, ReviewCreateError>>

  getQuestionReviewStatus(
    roomId: string,
    reviewId: string,
  ): Promise<Result<QuestionReviewAnswer, ReviewPollError | TimeoutError>>

  expireQuestionReview(
    roomId: string,
    reviewId: string,
  ): Promise<Result<void, ReviewPollError>>
}
