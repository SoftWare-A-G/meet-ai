import { matchError } from 'better-result'
import { createHookClient } from '@meet-ai/cli/lib/hooks/client'
import { getHomeCredentials } from '@meet-ai/cli/lib/meetai-home'
import { createHookContainer } from '../bootstrap'
import type { ProcessPlanReviewError } from '@meet-ai/domain'

function log(msg: string) {
  process.stderr.write(`[plan-review] ${msg}\n`)
}

function logError(error: ProcessPlanReviewError): void {
  matchError(error, {
    ParseError: (e) => log(`bad input: ${e.message}`),
    ValidationError: (e) => log(`validation failed on "${e.field}": ${e.message}`),
    RoomResolveError: (e) => log(`room not found: ${e.message}`),
    ReviewCreateError: (e) => log(`failed to create review: ${e.message}`),
    ReviewPollError: (e) => log(`poll failed: ${e.message}`),
    TimeoutError: (e) => log(`timed out: ${e.message}`),
  })
}

export async function processPlanReview(
  rawInput: string,
  teamsDir?: string,
  opts?: { pollInterval?: number; pollTimeout?: number },
): Promise<void> {
  const creds = getHomeCredentials()
  if (!creds) return

  const client = createHookClient(creds.url, creds.key)
  const { planReview } = createHookContainer(client, teamsDir, opts)
  const result = await planReview.execute(rawInput)

  if (result.isErr()) {
    logError(result.error)
    return
  }

  if (result.value) {
    process.stdout.write(JSON.stringify(result.value))
  }
}
