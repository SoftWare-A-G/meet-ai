import { ProcessPermissionReview } from '@meet-ai/domain'
import { createHookClient } from '@meet-ai/cli/lib/hooks/client'
import { getHomeCredentials } from '@meet-ai/cli/lib/meetai-home'
import { HookReviewRepository } from './review-repository'
import { HookTransportAdapter } from '../adapters/hook-transport'
import { SessionRoomResolver } from '../adapters/room-resolver'

function log(msg: string) {
  process.stderr.write(`[permission-review] ${msg}\n`)
}

export async function processPermissionReview(
  rawInput: string,
  teamsDir?: string,
  opts?: { pollInterval?: number; pollTimeout?: number },
): Promise<void> {
  const creds = getHomeCredentials()
  if (!creds) return

  const client = createHookClient(creds.url, creds.key)

  // Wire adapters → domain interfaces
  const repo = new HookReviewRepository(client, opts?.pollInterval, opts?.pollTimeout)
  const transport = new HookTransportAdapter(client)
  const resolver = new SessionRoomResolver(teamsDir)

  // Inject deps → domain usecase (no logger — domain is pure)
  const usecase = new ProcessPermissionReview(repo, transport, resolver)
  const result = await usecase.execute(rawInput)

  // CLI handles all logging + stdout output
  if (result.isErr()) {
    log(`${result.error._tag}: ${result.error.message}`)
    return
  }

  if (result.value) {
    process.stdout.write(JSON.stringify(result.value))
  }
}
