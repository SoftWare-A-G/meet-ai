import { matchError } from 'better-result'
import { createHookClient } from '@meet-ai/cli/lib/hooks/client'
import { getHomeCredentials } from '@meet-ai/cli/lib/meetai-home'
import { createHookContainer } from '../bootstrap'
import type { ProcessPermissionReviewError } from '@meet-ai/domain'

function log(msg: string) {
  process.stderr.write(`[permission-review] ${msg}\n`)
}

function logError(error: ProcessPermissionReviewError): void {
  matchError(error, {
    ParseError: (e) => log(`bad input: ${e.message}`),
    ValidationError: (e) => log(`validation failed on "${e.field}": ${e.message}`),
    RoomResolveError: (e) => log(`room not found: ${e.message}`),
    ReviewCreateError: (e) => log(`failed to create review: ${e.message}`),
    ReviewPollError: (e) => log(`poll failed: ${e.message}`),
    TimeoutError: (e) => log(`timed out: ${e.message}`),
  })
}

export async function processPermissionReview(
  rawInput: string,
  teamsDir?: string,
  opts?: { pollInterval?: number; pollTimeout?: number },
): Promise<void> {
  const creds = getHomeCredentials()
  if (!creds) return

  const client = createHookClient(creds.url, creds.key)
  const { permissionReview } = createHookContainer(client, teamsDir, opts)
  const result = await permissionReview.execute(rawInput)

  if (result.isErr()) {
    logError(result.error)
    return
  }

  if (result.value) {
    process.stdout.write(JSON.stringify(result.value))
  }
}
