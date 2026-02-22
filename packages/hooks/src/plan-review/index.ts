#!/usr/bin/env node
import { setTimeout as delay } from 'node:timers/promises'
import { createHookClient } from '../log-tool-use/client'
import { findRoomId } from '../log-tool-use/find-room'

type PlanReviewInput = {
  session_id: string
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

type PlanReviewResponse = {
  id: string
  message_id?: string
}

const POLL_INTERVAL_MS = 2000
const POLL_TIMEOUT_MS = 2_592_000_000 // 30 days

async function createPlanReview(
  client: ReturnType<typeof createHookClient>,
  roomId: string,
  planContent: string
): Promise<PlanReviewResponse | null> {
  try {
    const res = await client.api.rooms[':id']['plan-reviews'].$post({
      param: { id: roomId },
      json: { plan_content: planContent },
    })
    if (!res.ok) {
      const text = await res.text()
      process.stderr.write(`[plan-review] create failed: ${res.status} ${text}\n`)
      return null
    }
    return await res.json()
  } catch (error) {
    process.stderr.write(`[plan-review] create error: ${error}\n`)
    return null
  }
}

async function pollForDecision(
  client: ReturnType<typeof createHookClient>,
  roomId: string,
  reviewId: string
) {
  const deadline = Date.now() + POLL_TIMEOUT_MS

  while (Date.now() < deadline) {
    try {
      const res = await client.api.rooms[':id']['plan-reviews'][':reviewId'].$get({
        param: { id: roomId, reviewId },
      })
      if (res.ok) {
        const data = await res.json()
        if (data.status !== 'pending') {
          return data
        }
      }
    } catch (error) {
      process.stderr.write(`[plan-review] poll error: ${error}\n`)
    }

    await delay(POLL_INTERVAL_MS)
  }

  return null
}

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

async function expirePlanReview(
  client: ReturnType<typeof createHookClient>,
  roomId: string,
  reviewId: string
): Promise<void> {
  try {
    await client.api.rooms[':id']['plan-reviews'][':reviewId'].expire.$post({
      param: { id: roomId, reviewId },
    })
  } catch {
    // Never throw — hook must not block the agent
  }
}

async function processPlanReview(rawInput: string, teamsDir?: string): Promise<void> {
  let input: PlanReviewInput
  try {
    input = JSON.parse(rawInput)
  } catch {
    process.stderr.write('[plan-review] failed to parse stdin\n')
    return
  }

  const { session_id: sessionId } = input
  if (!sessionId) {
    process.stderr.write('[plan-review] missing session_id\n')
    return
  }

  const planContent = input.tool_input?.plan as string | undefined
  if (!planContent) {
    process.stderr.write('[plan-review] no plan content in tool_input\n')
    return
  }

  const roomId = findRoomId(sessionId, teamsDir)
  if (!roomId) {
    process.stderr.write('[plan-review] no room found for session\n')
    return
  }

  const url = process.env.MEET_AI_URL
  const key = process.env.MEET_AI_KEY
  if (!url || !key) {
    process.stderr.write('[plan-review] MEET_AI_URL or MEET_AI_KEY not set\n')
    return
  }

  const client = createHookClient(url, key)

  process.stderr.write(`[plan-review] sending plan to room ${roomId} via ${url}\n`)
  const review = await createPlanReview(client, roomId, planContent)
  if (!review) return

  process.stderr.write(`[plan-review] plan review created: ${review.id}, polling for decision...\n`)
  const decision = await pollForDecision(client, roomId, review.id)

  if (!decision) {
    process.stderr.write('[plan-review] timed out waiting for decision\n')
    await expirePlanReview(client, roomId, review.id)
    return
  }

  process.stderr.write(`[plan-review] decision: ${decision.status}\n`)

  if (decision.status === 'approved') {
    process.stdout.write(JSON.stringify(buildAllowOutput(decision.permission_mode)))
  } else if (decision.status === 'denied') {
    const feedback =
      decision.feedback || 'Plan was rejected. Please revise the plan based on the feedback.'
    process.stdout.write(JSON.stringify(buildDenyOutput(feedback)))
  }
}

// Main
async function main() {
  let input = ''
  for await (const chunk of process.stdin) {
    input += chunk
  }

  await processPlanReview(input)
}

const isDirectExecution = process.argv[1]?.includes('/hooks/')
if (isDirectExecution && !process.argv[1]?.includes('vitest')) {
  main().catch(error => {
    process.stderr.write(`[plan-review] fatal: ${error}\n`)
    process.exit(0)
  })
}
