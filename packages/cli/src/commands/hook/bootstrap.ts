import { ProcessPermissionReview, ProcessQuestionReview, ProcessPlanReview } from '@meet-ai/domain'
import type { HookClient } from '@meet-ai/cli/lib/hooks/client'
import { HookReviewRepository } from './permission-review/review-repository'
import { HookQuestionReviewRepository } from './question-review/review-repository'
import { HookPlanReviewRepository } from './plan-review/review-repository'
import { HookTransportAdapter } from './adapters/hook-transport'
import { SessionRoomResolver } from './adapters/room-resolver'

interface PollOpts {
  pollInterval?: number
  pollTimeout?: number
}

export function createHookContainer(
  client: HookClient,
  teamsDir?: string,
  pollOpts?: PollOpts,
) {
  // Shared deps — created once
  const resolver = new SessionRoomResolver(teamsDir)
  const transport = new HookTransportAdapter(client)

  // Per-hook repos (each has its own default timeout)
  const permissionRepo = new HookReviewRepository(client, pollOpts?.pollInterval, pollOpts?.pollTimeout)
  const questionRepo = new HookQuestionReviewRepository(client, pollOpts?.pollInterval, pollOpts?.pollTimeout)
  const planRepo = new HookPlanReviewRepository(client, pollOpts?.pollInterval, pollOpts?.pollTimeout)

  return {
    permissionReview: new ProcessPermissionReview(permissionRepo, transport, resolver),
    questionReview: new ProcessQuestionReview(questionRepo, transport, resolver),
    planReview: new ProcessPlanReview(planRepo, resolver),
  }
}
