import { createHookClient, type HookClient } from '../../../lib/hooks/client'
import { findRoomId } from '../../../lib/hooks/find-room'

type PermissionRequestInput = {
  session_id: string
  hook_event_name: string
  tool_name: string
  tool_input?: Record<string, unknown>
}

type HookOutput = {
  hookSpecificOutput: {
    hookEventName: 'PermissionRequest'
    decision:
      | { behavior: 'allow' }
      | { behavior: 'deny'; message: string }
  }
}

type PermissionReviewResponse = {
  id: string
  message_id?: string
}

type PermissionReviewStatus = {
  status: 'pending' | 'approved' | 'denied' | 'expired'
  feedback?: string
  decided_by?: string
  decided_at?: string
}

const POLL_INTERVAL_MS = 2000
const POLL_TIMEOUT_MS = 1_800_000 // 30 minutes

function formatPermissionRequest(toolName: string, toolInput?: Record<string, unknown>): string {
  let text = `**Permission request: ${toolName}**\n`

  if (toolInput) {
    // Show a compact summary of the tool input
    const entries = Object.entries(toolInput)
    if (entries.length > 0) {
      for (const [key, value] of entries) {
        const valueStr = typeof value === 'string' ? value : JSON.stringify(value)
        // Truncate long values
        const truncated = valueStr.length > 200 ? `${valueStr.slice(0, 200)}...` : valueStr
        text += `\n**${key}:** \`${truncated}\``
      }
    }
  }

  return text
}

async function createPermissionReview(
  client: HookClient,
  roomId: string,
  toolName: string,
  toolInput: Record<string, unknown> | undefined,
  formattedContent: string,
): Promise<PermissionReviewResponse | null> {
  try {
    const res = await client.api.rooms[':id']['permission-reviews'].$post({
      param: { id: roomId },
      json: {
        tool_name: toolName,
        tool_input_json: toolInput ? JSON.stringify(toolInput) : undefined,
        formatted_content: formattedContent,
      },
    })
    if (!res.ok) {
      const text = await res.text()
      process.stderr.write(`[permission-review] create failed: ${res.status} ${text}\n`)
      return null
    }
    return (await res.json()) as PermissionReviewResponse
  } catch (error) {
    process.stderr.write(`[permission-review] create error: ${error}\n`)
    return null
  }
}

async function pollForDecision(
  client: HookClient,
  roomId: string,
  reviewId: string,
  pollInterval = POLL_INTERVAL_MS,
  pollTimeout = POLL_TIMEOUT_MS,
): Promise<PermissionReviewStatus | null> {
  const deadline = Date.now() + pollTimeout

  while (Date.now() < deadline) {
    try {
      const res = await client.api.rooms[':id']['permission-reviews'][':reviewId'].$get({
        param: { id: roomId, reviewId },
      })
      if (res.ok) {
        const data = (await res.json()) as PermissionReviewStatus
        if (data.status !== 'pending') {
          return data
        }
      }
    } catch (error) {
      process.stderr.write(`[permission-review] poll error: ${error}\n`)
    }
    await new Promise((resolve) => setTimeout(resolve, pollInterval))
  }

  return null
}

function buildAllowOutput(): HookOutput {
  return {
    hookSpecificOutput: {
      hookEventName: 'PermissionRequest',
      decision: { behavior: 'allow' },
    },
  }
}

function buildDenyOutput(message: string): HookOutput {
  return {
    hookSpecificOutput: {
      hookEventName: 'PermissionRequest',
      decision: {
        behavior: 'deny',
        message,
      },
    },
  }
}

async function expireReview(
  client: HookClient,
  roomId: string,
  reviewId: string,
): Promise<void> {
  try {
    await client.api.rooms[':id']['permission-reviews'][':reviewId'].expire.$post({
      param: { id: roomId, reviewId },
    })
  } catch {
    // Never throw — hook must not block the agent
  }
}

async function sendTimeoutMessage(client: HookClient, roomId: string): Promise<void> {
  try {
    await client.api.rooms[':id'].messages.$post({
      param: { id: roomId },
      json: {
        sender: 'hook',
        content: '_Permission request timed out — approve in terminal instead._',
        sender_type: 'agent',
        color: '#f97316',
      },
    })
  } catch {
    // Never throw — hook must not block the agent
  }
}

export async function processPermissionReview(
  rawInput: string,
  teamsDir?: string,
  opts?: { pollInterval?: number; pollTimeout?: number },
): Promise<void> {
  let input: PermissionRequestInput
  try {
    input = JSON.parse(rawInput)
  } catch {
    process.stderr.write('[permission-review] failed to parse stdin\n')
    return
  }

  const { session_id: sessionId, hook_event_name: hookEventName, tool_name: toolName, tool_input: toolInput } = input
  if (!sessionId || !toolName) {
    process.stderr.write('[permission-review] missing session_id or tool_name\n')
    return
  }

  // Skip tools handled by dedicated hooks to avoid duplicate cards
  const EXCLUDED_TOOLS = ['ExitPlanMode', 'AskUserQuestion']
  if (EXCLUDED_TOOLS.includes(toolName)) {
    process.stderr.write(`[permission-review] skipping ${toolName} — handled by dedicated hook\n`)
    return
  }

  process.stderr.write(`[permission-review] triggered by ${hookEventName} for tool ${toolName}\n`)

  const roomId = findRoomId(sessionId, teamsDir)
  if (!roomId) {
    process.stderr.write('[permission-review] no room found for session\n')
    return
  }

  const url = process.env.MEET_AI_URL
  const key = process.env.MEET_AI_KEY
  if (!url || !key) {
    process.stderr.write('[permission-review] MEET_AI_URL or MEET_AI_KEY not set\n')
    return
  }

  const client = createHookClient(url, key)
  const formattedContent = formatPermissionRequest(toolName, toolInput)

  process.stderr.write(`[permission-review] sending permission request to room ${roomId} via ${url}\n`)
  const review = await createPermissionReview(client, roomId, toolName, toolInput, formattedContent)
  if (!review) return

  process.stderr.write(`[permission-review] created: ${review.id}, polling for decision...\n`)
  const result = await pollForDecision(
    client,
    roomId,
    review.id,
    opts?.pollInterval,
    opts?.pollTimeout,
  )

  if (!result) {
    process.stderr.write('[permission-review] timed out waiting for decision\n')
    await expireReview(client, roomId, review.id)
    await sendTimeoutMessage(client, roomId)
    return
  }

  process.stderr.write(`[permission-review] decision received: ${result.status}\n`)

  if (result.status === 'approved') {
    process.stdout.write(JSON.stringify(buildAllowOutput()))
  } else if (result.status === 'denied') {
    const message = result.feedback || 'Permission denied by user.'
    process.stdout.write(JSON.stringify(buildDenyOutput(message)))
  }
  // If expired, output nothing — falls through to terminal prompt
}
