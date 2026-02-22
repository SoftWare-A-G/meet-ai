#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { findRoomId } from '../log-tool-use/find-room'
import { createHookClient } from '../log-tool-use/client'

type PlanReviewInput = {
  session_id: string
  tool_name: string
  tool_input?: Record<string, unknown>
  permission_mode?: string
}

type HookOutput = {
  hookSpecificOutput: {
    hookEventName: 'PermissionRequest'
    decision: {
      behavior: 'allow'
    } | {
      behavior: 'deny'
      message: string
    }
  }
}

type PlanReviewResponse = {
  id: string
  message_id?: string
}

type PlanReviewStatus = {
  status: 'pending' | 'approved' | 'denied'
  feedback?: string
  decided_by?: string
  decided_at?: string
}

const POLL_INTERVAL_MS = 2000
const POLL_TIMEOUT_MS = 1_800_000 // 30 minutes

function findLatestPlanFile(): string | null {
  const plansDir = join(process.env.HOME || '', '.claude', 'plans')
  let entries: string[]
  try {
    entries = readdirSync(plansDir)
  } catch {
    return null
  }

  let latest: { path: string; mtime: number } | null = null
  for (const entry of entries) {
    if (!entry.endsWith('.md')) continue
    const fullPath = join(plansDir, entry)
    try {
      const mtime = statSync(fullPath).mtimeMs
      if (!latest || mtime > latest.mtime) {
        latest = { path: fullPath, mtime }
      }
    } catch {
      continue
    }
  }

  if (!latest) return null
  return readFileSync(latest.path, 'utf-8')
}

async function createPlanReview(
  client: ReturnType<typeof createHookClient>,
  roomId: string,
  planContent: string,
): Promise<PlanReviewResponse | null> {
  try {
    const res = await client.api.rooms[':id']['plan-reviews'].$post({
      param: { id: roomId },
      json: { plan_content: planContent },
    } as any)
    if (!res.ok) {
      const text = await res.text()
      process.stderr.write(`[plan-review] create failed: ${res.status} ${text}\n`)
      return null
    }
    return (await res.json()) as PlanReviewResponse
  } catch (err) {
    process.stderr.write(`[plan-review] create error: ${err}\n`)
    return null
  }
}

async function pollForDecision(
  client: ReturnType<typeof createHookClient>,
  roomId: string,
  reviewId: string,
): Promise<PlanReviewStatus | null> {
  const deadline = Date.now() + POLL_TIMEOUT_MS

  while (Date.now() < deadline) {
    try {
      const res = await client.api.rooms[':id']['plan-reviews'][':reviewId'].$get({
        param: { id: roomId, reviewId },
      } as any)
      if (res.ok) {
        const data = (await res.json()) as PlanReviewStatus
        if (data.status !== 'pending') {
          return data
        }
      }
    } catch (err) {
      process.stderr.write(`[plan-review] poll error: ${err}\n`)
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
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
  reviewId: string,
): Promise<void> {
  try {
    await (client.api.rooms[':id']['plan-reviews'][':reviewId'].expire as any).$post({
      param: { id: roomId, reviewId },
    })
  } catch {
    // Never throw — hook must not block the agent
  }
}

async function sendTimeoutMessage(
  client: ReturnType<typeof createHookClient>,
  roomId: string,
): Promise<void> {
  try {
    await client.api.rooms[':id'].messages.$post({
      param: { id: roomId },
      json: {
        sender: 'hook',
        content: '_Plan review timed out — approve/deny in terminal instead._',
        sender_type: 'agent' as const,
        color: '#8b5cf6',
      },
    })
  } catch {
    // Never throw — hook must not block the agent
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

  const { session_id: sessionId } = input
  if (!sessionId) {
    process.stderr.write('[plan-review] missing session_id\n')
    return
  }

  const planContent = findLatestPlanFile()
  if (!planContent) {
    process.stderr.write('[plan-review] no plan file found in ~/.claude/plans/\n')
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
    await sendTimeoutMessage(client, roomId)
    return
  }

  process.stderr.write(`[plan-review] decision: ${decision.status}\n`)

  if (decision.status === 'approved') {
    process.stdout.write(JSON.stringify(buildAllowOutput()))
  } else if (decision.status === 'denied') {
    const feedback = decision.feedback || 'Plan was rejected. Please revise the plan based on the feedback.'
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
  main().catch((err) => {
    process.stderr.write(`[plan-review] fatal: ${err}\n`)
    process.exit(0)
  })
}
