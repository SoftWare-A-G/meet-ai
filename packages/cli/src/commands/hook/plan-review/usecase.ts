import { createHookClient } from '@meet-ai/cli/lib/hooks/client'
import { getHomeCredentials } from '@meet-ai/cli/lib/meetai-home'
import { findRoomId } from '@meet-ai/cli/lib/hooks/find-room'
import {
  createPlanReview,
  expirePlanReview,
  pollForPlanDecision,
} from '@meet-ai/cli/lib/plan-review'

type PlanReviewInput = {
  session_id: string
  transcript_path?: string
  tool_name: string
  tool_input?: Record<string, unknown>
  permission_mode?: string
}

type AllowedPrompt = { tool: string; prompt: string }

type HookOutput = {
  hookSpecificOutput: {
    hookEventName: 'PermissionRequest'
    decision:
      | { behavior: 'allow'; allowedPrompts?: AllowedPrompt[] }
      | { behavior: 'deny'; message: string }
  }
}

const POLL_INTERVAL_MS = 2000
const POLL_TIMEOUT_MS = 2_592_000_000 // 30 days

function getPromptsByMode(mode?: string): AllowedPrompt[] | undefined {
  switch (mode) {
    case 'acceptEdits': {
      return [
        { tool: 'Bash', prompt: 'install dependencies' },
        { tool: 'Bash', prompt: 'run tests' },
        { tool: 'Bash', prompt: 'run build' },
        { tool: 'Bash', prompt: 'run typecheck' },
        { tool: 'Bash', prompt: 'run linter' },
      ]
    }
    case 'bypassPermissions': {
      return [{ tool: 'Bash', prompt: 'run any command' }]
    }
    default: {
      return undefined
    }
  }
}

function buildAllowOutput(permissionMode?: string): HookOutput {
  const allowedPrompts = getPromptsByMode(permissionMode)
  return {
    hookSpecificOutput: {
      hookEventName: 'PermissionRequest',
      decision: allowedPrompts ? { behavior: 'allow', allowedPrompts } : { behavior: 'allow' },
    },
  }
}

function buildDenyOutput(feedback: string): HookOutput {
  return {
    hookSpecificOutput: {
      hookEventName: 'PermissionRequest',
      decision: {
        behavior: 'deny',
        message: feedback,
      },
    },
  }
}

export async function processPlanReview(rawInput: string, teamsDir?: string): Promise<void> {
  let input: PlanReviewInput
  try {
    input = JSON.parse(rawInput)
  } catch {
    process.stderr.write('[plan-review] failed to parse stdin\n')
    return
  }

  const { session_id: sessionId, transcript_path: transcriptPath } = input
  if (!sessionId) {
    process.stderr.write('[plan-review] missing session_id\n')
    return
  }

  const planContent =
    (input.tool_input?.plan as string | undefined) ||
    '_Agent requested to exit plan mode without a plan._'

  const roomId = await findRoomId(sessionId, teamsDir, transcriptPath)
  if (!roomId) {
    process.stderr.write('[plan-review] no room found for session\n')
    return
  }

  const creds = getHomeCredentials()
  if (!creds) return
  const { url, key } = creds

  const client = createHookClient(url, key)

  process.stderr.write(`[plan-review] sending plan to room ${roomId} via ${url}\n`)
  const review = await createPlanReview(client, roomId, planContent)
  if (!review.ok) {
    if (review.error) {
      process.stderr.write(`[plan-review] create error: ${review.error}\n`)
    } else {
      process.stderr.write(`[plan-review] create failed: ${review.status} ${review.text ?? ''}\n`)
    }
    return
  }

  process.stderr.write(`[plan-review] plan review created: ${review.review.id}, polling for decision...\n`)
  const decision = await pollForPlanDecision(client, roomId, review.review.id, POLL_INTERVAL_MS, POLL_TIMEOUT_MS)

  if (!decision) {
    process.stderr.write('[plan-review] timed out waiting for decision\n')
    await expirePlanReview(client, roomId, review.review.id)
    return
  }

  process.stderr.write(`[plan-review] decision: ${decision.status}\n`)

  if (decision.status === 'approved') {
    process.stdout.write(JSON.stringify(buildAllowOutput(decision.permission_mode)))
  } else if (decision.status === 'denied' || decision.status === 'expired') {
    const feedback =
      decision.feedback || (decision.status === 'expired'
        ? 'Plan was dismissed. Please revise the plan or ask for guidance.'
        : 'Plan was rejected. Please revise the plan based on the feedback.')
    process.stdout.write(JSON.stringify(buildDenyOutput(feedback)))
  }
}
