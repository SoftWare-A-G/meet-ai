import { createHookClient } from '@meet-ai/cli/lib/hooks/client'
import { getHomeCredentials } from '@meet-ai/cli/lib/meetai-home'
import { ProcessTaskSync } from '@meet-ai/domain'
import { HookTaskRepository } from './task-repository'
import { SessionRoomResolver } from '../adapters/room-resolver'

function log(msg: string) {
  process.stderr.write(`[task-sync] ${msg}\n`)
}

export async function processTaskSync(
  rawInput: string,
  teamsDir?: string,
): Promise<'sent' | 'skip'> {
  const creds = getHomeCredentials()
  if (!creds) return 'skip'

  const client = createHookClient(creds.url, creds.key)
  const repo = new HookTaskRepository(client)
  const resolver = new SessionRoomResolver(teamsDir)
  const usecase = new ProcessTaskSync(repo, resolver)
  const result = await usecase.execute(rawInput)

  if (result.isErr()) {
    log(`${result.error._tag}: ${result.error.message}`)
    return 'skip'
  }

  return 'sent'
}
