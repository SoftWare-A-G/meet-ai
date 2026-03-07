import { readFileSync, writeFileSync, statSync, rmSync } from 'node:fs'
import {
  findRoom,
  summarize,
  formatDiff,
  formatWriteDiff,
  createHookClient,
  sendParentMessage,
  sendLogEntry,
  sendTeamMemberUpsert,
  type HookInput,
  type StructuredPatchHunk,
} from '@meet-ai/cli/lib/hooks'

const PARENT_MSG_TTL_SEC = 120

function getOrCreateParentId(sessionId: string): string | null {
  const path = `/tmp/meet-ai-hook-${sessionId}.msgid`
  try {
    const mtime = statSync(path).mtimeMs
    if (Date.now() - mtime > PARENT_MSG_TTL_SEC * 1000) {
      rmSync(path, { force: true })
      return null
    }
    return readFileSync(path, 'utf-8').trim() || null
  } catch {
    return null
  }
}

function saveParentId(sessionId: string, msgId: string) {
  try {
    writeFileSync(`/tmp/meet-ai-hook-${sessionId}.msgid`, msgId)
  } catch {
    // /tmp may be unavailable — silently ignore
  }
}

export async function processHookInput(
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
    tool_input: toolInput = {},
    tool_response: toolResponse,
  } = input
  if (!sessionId || !toolName) return 'skip'

  // Skip Bash cd and meet-ai commands (avoid recursion)
  if (toolName === 'Bash') {
    const cmd = typeof toolInput.command === 'string' ? toolInput.command : ''
    if (cmd.startsWith('cd ') || cmd.startsWith('meet-ai ')) return 'skip'
  }

  // Find room
  const room = await findRoom(sessionId, teamsDir, transcriptPath)
  if (!room) return 'skip'
  const { roomId, teamName } = room

  // Need env vars
  const url = process.env.MEET_AI_URL
  const key = process.env.MEET_AI_KEY
  if (!url || !key) return 'skip'

  const client = createHookClient(url, key)

  // Detect agent spawn
  if (toolName === 'Agent' && toolResponse) {
    const status = toolResponse.status as string | undefined
    if (status === 'teammate_spawned') {
      await sendTeamMemberUpsert(client, roomId, toolResponse.team_name as string, {
        teammate_id: toolResponse.teammate_id as string,
        name: toolResponse.name as string,
        color: toolResponse.color as string,
        role: (toolResponse.agent_type as string) || 'teammate',
        model: (toolResponse.model as string) || 'unknown',
        status: 'active',
        joinedAt: Date.now(),
      })
    }
  }

  // Detect agent shutdown
  if (toolName === 'SendMessage') {
    const inputType = toolInput.type as string | undefined
    const approve = toolInput.approve as boolean | undefined

    if (inputType === 'shutdown_response' && approve === true) {
      const requestId = toolInput.request_id as string | undefined
      const agentName = requestId?.split('@')[1]

      if (agentName) {
        const teammateId = teamName ? `${agentName}@${teamName}` : agentName
        await sendTeamMemberUpsert(client, roomId, teamName, {
          teammate_id: teammateId,
          name: agentName,
          color: '#555',
          role: 'teammate',
          model: 'unknown',
          status: 'inactive',
          joinedAt: 0,
        })
      }
    }
    // Skip normal log for SendMessage — internal agent communication
    return 'skip'
  }

  // Edit tool with structuredPatch → send diff log instead of one-liner summary
  if (toolName === 'Edit' && toolResponse?.structuredPatch) {
    const hunks = toolResponse.structuredPatch as StructuredPatchHunk[]
    const filePath = typeof toolInput.file_path === 'string' ? toolInput.file_path : '?'
    const diffContent = formatDiff(filePath, hunks)

    let parentId = getOrCreateParentId(sessionId)
    if (!parentId) {
      parentId = await sendParentMessage(client, roomId)
      if (parentId) saveParentId(sessionId, parentId)
    }

    await sendLogEntry(client, roomId, diffContent, parentId ?? undefined)
    return 'sent'
  }

  // Write tool → send diff showing entire file as additions
  if (toolName === 'Write' && typeof toolInput.content === 'string') {
    const filePath = typeof toolInput.file_path === 'string' ? toolInput.file_path : '?'
    const diffContent = formatWriteDiff(filePath, toolInput.content)

    let parentId = getOrCreateParentId(sessionId)
    if (!parentId) {
      parentId = await sendParentMessage(client, roomId)
      if (parentId) saveParentId(sessionId, parentId)
    }

    await sendLogEntry(client, roomId, diffContent, parentId ?? undefined)
    return 'sent'
  }

  const summary = summarize(toolName, toolInput as Record<string, unknown>)

  // Get or create parent message
  let parentId = getOrCreateParentId(sessionId)
  if (!parentId) {
    parentId = await sendParentMessage(client, roomId)
    if (parentId) saveParentId(sessionId, parentId)
  }

  // Send log entry
  await sendLogEntry(client, roomId, summary, parentId ?? undefined)

  return 'sent'
}
