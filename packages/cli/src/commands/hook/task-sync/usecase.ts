import {
  findRoom,
  createHookClient,
} from '@meet-ai/cli/lib/hooks'
import { getHomeCredentials } from '@meet-ai/cli/lib/meetai-home'
import { TaskHookInput } from './schema'

const CLAUDE_STATUS_MAP: Record<string, string> = {
  open: 'pending',
  in_progress: 'in_progress',
  completed: 'completed',
  done: 'completed',
}

function mapStatus(status: unknown): 'pending' | 'in_progress' | 'completed' | undefined {
  if (typeof status !== 'string') return undefined
  const mapped = CLAUDE_STATUS_MAP[status]
  if (mapped) return mapped as 'pending' | 'in_progress' | 'completed'
  if (['pending', 'in_progress', 'completed'].includes(status)) {
    return status as 'pending' | 'in_progress' | 'completed'
  }
  return undefined
}

export async function processTaskSync(
  rawInput: string,
  teamsDir?: string
): Promise<'sent' | 'skip'> {
  let raw: unknown
  try {
    raw = JSON.parse(rawInput)
  } catch {
    return 'skip'
  }

  const parsed = TaskHookInput.safeParse(raw)
  if (!parsed.success) return 'skip'

  const input = parsed.data

  // Find room
  const room = await findRoom(input.session_id, teamsDir, input.transcript_path)
  if (!room) return 'skip'
  const { roomId } = room

  // Need credentials from home config
  const creds = getHomeCredentials()
  if (!creds) return 'skip'
  const { url, key } = creds

  const client = createHookClient(url, key)

  // Build upsert payload based on tool type
  const body: Record<string, unknown> = {
    source: 'claude' as const,
    updated_by: 'claude',
  }

  if (input.tool_name === 'TaskCreate') {
    body.source_id = input.tool_response.task.id
    body.subject = input.tool_input.subject
    body.status = 'pending'
    if (input.tool_input.description) body.description = input.tool_input.description
  } else {
    // TaskUpdate
    body.source_id = input.tool_response.taskId

    if (input.tool_input.subject) body.subject = input.tool_input.subject
    if (input.tool_input.description) body.description = input.tool_input.description
    if (input.tool_input.status) body.status = mapStatus(input.tool_input.status)
    if (input.tool_input.owner !== undefined) body.assignee = input.tool_input.owner
  }

  const res = await client.api.rooms[':id'].tasks.upsert.$post({
    param: { id: roomId },
    json: body as {
      source: 'claude' | 'codex' | 'meet_ai'
      source_id: string
      subject?: string
      description?: string
      status?: 'pending' | 'in_progress' | 'completed'
      assignee?: string | null
      updated_by?: string | null
    },
  })

  if (!res.ok) {
    console.error(`[task-sync] upsert failed: ${res.status} ${res.statusText}`)
    return 'skip'
  }

  return 'sent'
}
