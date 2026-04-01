import { Result } from 'better-result'
import type { IReviewRepository, CreateReviewResult, PermissionReviewDecision } from '@meet-ai/domain'
import { ReviewCreateError, ReviewPollError, TimeoutError } from '@meet-ai/domain'
import type { HookClient } from '@meet-ai/cli/lib/hooks/client'

const POLL_INTERVAL_MS = 2000
const POLL_TIMEOUT_MS = 1_800_000 // 30 minutes

export class HookReviewRepository implements IReviewRepository {
  constructor(
    private readonly client: HookClient,
    private readonly pollInterval = POLL_INTERVAL_MS,
    private readonly pollTimeout = POLL_TIMEOUT_MS,
  ) {}

  async createPermissionReview(
    roomId: string,
    toolName: string,
    toolInput: Record<string, unknown> | undefined,
    formattedContent: string,
  ): Promise<Result<CreateReviewResult, ReviewCreateError>> {
    return Result.tryPromise({
      try: async () => {
        const res = await this.client.api.rooms[':id']['permission-reviews'].$post({
          param: { id: roomId },
          json: {
            tool_name: toolName,
            tool_input_json: toolInput ? JSON.stringify(toolInput) : undefined,
            formatted_content: formattedContent,
          },
        })
        if (!res.ok) {
          const body = await res.json()
          throw new ReviewCreateError({ message: `HTTP ${res.status}: ${body.error}` })
        }
        return res.json()
      },
      catch: (e) => e instanceof ReviewCreateError ? e : new ReviewCreateError({ message: String(e) }),
    })
  }

  async getPermissionReviewStatus(
    roomId: string,
    reviewId: string,
  ): Promise<Result<PermissionReviewDecision, ReviewPollError | TimeoutError>> {
    return Result.tryPromise({
      try: async () => {
        const deadline = Date.now() + this.pollTimeout
        let sawPending = false
        while (Date.now() < deadline) {
          try {
            const res = await this.client.api.rooms[':id']['permission-reviews'][':reviewId'].$get({
              param: { id: roomId, reviewId },
            })
            if (!res.ok) {
              const body = await res.json()
              throw new ReviewPollError({ message: `HTTP ${res.status}: ${body.error}` })
            }
            const json = await res.json()
            if (json.status !== 'pending') return json
            sawPending = true
          } catch (error) {
            if (error instanceof ReviewPollError) throw error
            process.stderr.write(`[permission-review] poll error: ${error}\n`)
          }
          await new Promise((resolve) => setTimeout(resolve, this.pollInterval))
        }
        if (sawPending) throw new TimeoutError({ message: 'Timed out waiting for decision' })
        throw new ReviewPollError({ message: 'Poll failed — never received a response' })
      },
      catch: (e): ReviewPollError | TimeoutError => {
        if (e instanceof ReviewPollError) return e
        if (e instanceof TimeoutError) return e
        return new ReviewPollError({ message: String(e) })
      },
    })
  }

  async expirePermissionReview(
    roomId: string,
    reviewId: string,
  ): Promise<Result<void, ReviewPollError>> {
    return Result.tryPromise({
      try: async () => {
        const res = await this.client.api.rooms[':id']['permission-reviews'][':reviewId'].expire.$post({
          param: { id: roomId, reviewId },
        })
        if (!res.ok) {
          const body = await res.json()
          throw new ReviewPollError({ message: `HTTP ${res.status}: ${body.error}` })
        }
      },
      catch: (e) => e instanceof ReviewPollError ? e : new ReviewPollError({ message: String(e) }),
    })
  }
}
