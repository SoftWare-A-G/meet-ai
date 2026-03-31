import { Result } from 'better-result'
import type { IQuestionReviewRepository, CreateReviewResult, QuestionReviewAnswer, QuestionItem } from '@meet-ai/domain'
import { ReviewCreateError, ReviewPollError, TimeoutError } from '@meet-ai/domain'
import type { HookClient } from '@meet-ai/cli/lib/hooks/client'

const POLL_INTERVAL_MS = 2000
const POLL_TIMEOUT_MS = 1_800_000 // 30 minutes

export class HookQuestionReviewRepository implements IQuestionReviewRepository {
  constructor(
    private readonly client: HookClient,
    private readonly pollInterval = POLL_INTERVAL_MS,
    private readonly pollTimeout = POLL_TIMEOUT_MS,
  ) {}

  async createQuestionReview(
    roomId: string,
    questions: QuestionItem[],
    formattedContent: string,
  ): Promise<Result<CreateReviewResult, ReviewCreateError>> {
    try {
      const res = await this.client.api.rooms[':id']['question-reviews'].$post({
        param: { id: roomId },
        json: {
          questions_json: JSON.stringify(questions),
          formatted_content: formattedContent,
        },
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

  async getQuestionReviewStatus(
    roomId: string,
    reviewId: string,
  ): Promise<Result<QuestionReviewAnswer, ReviewPollError | TimeoutError>> {
    const deadline = Date.now() + this.pollTimeout
    let sawPending = false
    while (Date.now() < deadline) {
      try {
        const res = await this.client.api.rooms[':id']['question-reviews'][':reviewId'].$get({
          param: { id: roomId, reviewId },
        })
        if (!res.ok) {
          const body = await res.json()
          return Result.err(new ReviewPollError({ message: `HTTP ${res.status}: ${body.error}` }))
        }
        const json = await res.json()
        if (json.status !== 'pending') return Result.ok(json)
        sawPending = true
      } catch (error) {
        process.stderr.write(`[question-review] poll error: ${error}\n`)
      }
      await new Promise((resolve) => setTimeout(resolve, this.pollInterval))
    }
    if (sawPending) {
      return Result.err(new TimeoutError({ message: 'Timed out waiting for decision' }))
    }
    return Result.err(new ReviewPollError({ message: 'Poll failed — never received a response' }))
  }

  async expireQuestionReview(
    roomId: string,
    reviewId: string,
  ): Promise<Result<void, ReviewPollError>> {
    try {
      const res = await this.client.api.rooms[':id']['question-reviews'][':reviewId'].expire.$post({
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
