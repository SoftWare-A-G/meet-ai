import { matchError } from 'better-result'
import { createHookClient } from '@meet-ai/cli/lib/hooks/client'
import { getHomeCredentials } from '@meet-ai/cli/lib/meetai-home'
import { ProcessTaskSync } from '@meet-ai/domain'
import { HookTaskRepository } from './task-repository'
import { SessionRoomResolver } from '../adapters/room-resolver'
import type { ProcessTaskSyncError } from '@meet-ai/domain'

function log(msg: string) {
  process.stderr.write(`[task-sync] ${msg}\n`)
}

function logError(error: ProcessTaskSyncError): void {
  matchError(error, {
    ParseError: (e) => log(`bad input: ${e.message}`),
    ValidationError: (e) => log(`validation failed on "${e.field}": ${e.message}`),
    RoomResolveError: (e) => log(`room not found: ${e.message}`),
    TaskUpsertError: (e) => log(`task upsert failed: ${e.message}`),
  })
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
    logError(result.error)
    return 'skip'
  }

  return 'sent'
}
