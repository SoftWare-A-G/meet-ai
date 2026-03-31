import { ProcessQuestionReview } from '@meet-ai/domain'
import { createHookClient } from '@meet-ai/cli/lib/hooks/client'
import { getHomeCredentials } from '@meet-ai/cli/lib/meetai-home'
import { HookQuestionReviewRepository } from './review-repository'
import { HookTransportAdapter } from '../adapters/hook-transport'
import { SessionRoomResolver } from '../adapters/room-resolver'

function log(msg: string) {
  process.stderr.write(`[question-review] ${msg}\n`)
}

export async function processQuestionReview(
  rawInput: string,
  teamsDir?: string,
  opts?: { pollInterval?: number; pollTimeout?: number },
): Promise<void> {
  const creds = getHomeCredentials()
  if (!creds) return

  const client = createHookClient(creds.url, creds.key)

  const repo = new HookQuestionReviewRepository(client, opts?.pollInterval, opts?.pollTimeout)
  const transport = new HookTransportAdapter(client)
  const resolver = new SessionRoomResolver(teamsDir)

  const usecase = new ProcessQuestionReview(repo, transport, resolver)
  const result = await usecase.execute(rawInput)

  if (result.isErr()) {
    log(`${result.error._tag}: ${result.error.message}`)
    return
  }

  if (result.value) {
    process.stdout.write(JSON.stringify(result.value))
  }
}
