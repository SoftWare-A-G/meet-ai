import {
  findRoom,
  createHookClient,
  type HookInput,
} from '@meet-ai/cli/lib/hooks'

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
  // If it's already a valid status, pass through
  if (['pending', 'in_progress', 'completed'].includes(status)) {
    return status as 'pending' | 'in_progress' | 'completed'
  }
  return undefined
}

export async function processTaskSync(
  rawInput: string,
  teamsDir?: string
): Promise<'sent' | 'skip'> {
  let input: HookInput
  try {
    input = JSON.parse(rawInput)
  } catch {
    return 'skip'
  }

  const {
    session_id: sessionId,
    transcript_path: transcriptPath,
    tool_name: toolName,
    tool_response: toolResponse,
  } = input

  if (!sessionId || !toolName) return 'skip'

  // Only process TaskCreate and TaskUpdate
  if (toolName !== 'TaskCreate' && toolName !== 'TaskUpdate') return 'skip'

  // Must have a response with an id
  if (!toolResponse || typeof toolResponse.id !== 'string') return 'skip'

  // Find room
  const room = await findRoom(sessionId, teamsDir, transcriptPath)
  if (!room) return 'skip'
  const { roomId } = room

  // Need env vars
  const url = process.env.MEET_AI_URL
  const key = process.env.MEET_AI_KEY
  if (!url || !key) return 'skip'

  const client = createHookClient(url, key)

  // Build upsert payload
  const title = typeof toolResponse.title === 'string' ? toolResponse.title : undefined
  const status = mapStatus(toolResponse.status)
  const assignee = typeof toolResponse.owner === 'string' ? toolResponse.owner : undefined

  // TaskCreate must have a title
  if (toolName === 'TaskCreate' && !title) return 'skip'

  const body: Record<string, unknown> = {
    source: 'claude' as const,
    source_id: toolResponse.id as string,
    updated_by: 'claude',
  }

  if (title) body.subject = title
  if (status) body.status = status
  if (assignee !== undefined) body.assignee = assignee

  const res = await client.api.rooms[':id'].tasks.upsert.$post({
    param: { id: roomId },
    json: body as {
      source: 'claude' | 'codex' | 'meet_ai'
      source_id: string
      subject?: string
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
