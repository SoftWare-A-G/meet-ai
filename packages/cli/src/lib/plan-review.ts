import type { TurnPlanStep } from '@meet-ai/cli/generated/codex-app-server/v2/TurnPlanStep'
import type { HookClient } from '@meet-ai/cli/lib/hooks/client'

export type PlanReviewResponse = {
  id: string
  message_id?: string
}

export type CreatePlanReviewResult =
  | { ok: true; review: PlanReviewResponse }
  | { ok: false; status?: number; text?: string; error?: unknown }

export type PlanDecision = {
  id?: string
  message_id?: string
  status: 'pending' | 'approved' | 'denied' | 'expired'
  feedback?: string
  decided_by?: string
  decided_at?: string
  permission_mode?: string
}

export const PLAN_REVIEW_POLL_INTERVAL_MS = 2000
export const PLAN_REVIEW_POLL_TIMEOUT_MS = 2_592_000_000 // 30 days

function formatPlanStepStatus(status: TurnPlanStep['status']): string {
  switch (status) {
    case 'inProgress': {
      return 'in_progress'
    }
    case 'pending': {
      return 'draft'
    }
    default: {
      return status
    }
  }
}

export function formatCodexPlanReviewContent(input: {
  explanation?: string | null
  plan: TurnPlanStep[]
}): string {
  const sections: string[] = ['**Plan preview**']

  const explanation = input.explanation?.trim()
  if (explanation) {
    sections.push('', explanation)
  }

  if (input.plan.length > 0) {
    sections.push(
      '',
      ...input.plan.map(
        (step, index) => `${index + 1}. [${formatPlanStepStatus(step.status)}] ${step.step}`
      )
    )
  } else {
    sections.push('', '_Codex updated the turn plan without any structured steps._')
  }

  return sections.join('\n')
}

export async function createPlanReview(
  client: HookClient,
  roomId: string,
  planContent: string
): Promise<CreatePlanReviewResult> {
  try {
    const res = await client.api.rooms[':id']['plan-reviews'].$post({
      param: { id: roomId },
      json: { plan_content: planContent },
    })
    if (!res.ok) {
      return { ok: false, status: res.status, text: await res.text() }
    }
    return { ok: true, review: (await res.json()) as PlanReviewResponse }
  } catch (error) {
    return { ok: false, error }
  }
}

export async function pollForPlanDecision(
  client: HookClient,
  roomId: string,
  reviewId: string,
  pollInterval = PLAN_REVIEW_POLL_INTERVAL_MS,
  pollTimeout = PLAN_REVIEW_POLL_TIMEOUT_MS
): Promise<PlanDecision | null> {
  const deadline = Date.now() + pollTimeout

  while (Date.now() < deadline) {
    try {
      const res = await client.api.rooms[':id']['plan-reviews'][':reviewId'].$get({
        param: { id: roomId, reviewId },
      })
      if (res.ok) {
        const data = (await res.json()) as PlanDecision
        if (data.status !== 'pending') {
          return data
        }
      }
    } catch {
      // Callers can add context-specific logging if needed.
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval))
  }

  return null
}

export async function expirePlanReview(
  client: HookClient,
  roomId: string,
  reviewId: string
): Promise<void> {
  try {
    await client.api.rooms[':id']['plan-reviews'][':reviewId'].expire.$post({
      param: { id: roomId, reviewId },
    })
  } catch {
    // Best-effort cleanup only.
  }
}
