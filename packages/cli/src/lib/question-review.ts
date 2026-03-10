import type { HookClient } from '@meet-ai/cli/lib/hooks/client'

export type QuestionReviewOption = {
  label: string
  description?: string
}

export type QuestionReviewQuestion = {
  question: string
  header?: string
  options: QuestionReviewOption[]
  multiSelect?: boolean
}

type QuestionReviewResponse = {
  id: string
  message_id?: string
}

type QuestionReviewStatus = {
  status: 'pending' | 'answered' | 'expired'
  answers_json?: string
  answered_by?: string
  answered_at?: string
}

export type QuestionReviewResult =
  | { status: 'answered'; answers: Record<string, string> }
  | { status: 'expired' | 'timeout' | 'failed' }

export type CreateQuestionReviewResult =
  | { ok: true; review: QuestionReviewResponse }
  | { ok: false; status?: number; text?: string; error?: unknown }

export const QUESTION_REVIEW_POLL_INTERVAL_MS = 2000
export const QUESTION_REVIEW_POLL_TIMEOUT_MS = 1_800_000

export function formatQuestionReviewContent(questions: QuestionReviewQuestion[]): string {
  return questions
    .map(question => {
      const lines = [`**${question.question}**`]

      for (let index = 0; index < question.options.length; index += 1) {
        const option = question.options[index]
        let line = `${index + 1}. **${option.label}**`
        if (option.description) line += ` — ${option.description}`
        lines.push(line)
      }

      if (question.multiSelect) {
        lines.push('', '_Multiple choices allowed._')
      }

      return lines.join('\n')
    })
    .join('\n\n')
}

export async function createQuestionReview(
  client: HookClient,
  roomId: string,
  questions: QuestionReviewQuestion[],
  formattedContent: string,
): Promise<CreateQuestionReviewResult> {
  try {
    const res = await client.api.rooms[':id']['question-reviews'].$post({
      param: { id: roomId },
      json: {
        questions_json: JSON.stringify(questions),
        formatted_content: formattedContent,
      },
    })
    if (!res.ok) {
      return { ok: false, status: res.status, text: await res.text() }
    }
    return { ok: true, review: (await res.json()) as QuestionReviewResponse }
  } catch (error) {
    return { ok: false, error }
  }
}

export async function pollForQuestionReviewAnswer(
  client: HookClient,
  roomId: string,
  reviewId: string,
  pollInterval = QUESTION_REVIEW_POLL_INTERVAL_MS,
  pollTimeout = QUESTION_REVIEW_POLL_TIMEOUT_MS,
): Promise<QuestionReviewStatus | null> {
  const deadline = Date.now() + pollTimeout

  while (Date.now() < deadline) {
    try {
      const res = await client.api.rooms[':id']['question-reviews'][':reviewId'].$get({
        param: { id: roomId, reviewId },
      })
      if (res.ok) {
        const data = (await res.json()) as QuestionReviewStatus
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

export async function expireQuestionReview(
  client: HookClient,
  roomId: string,
  reviewId: string,
): Promise<void> {
  try {
    await client.api.rooms[':id']['question-reviews'][':reviewId'].expire.$post({
      param: { id: roomId, reviewId },
    })
  } catch {
    // Best-effort cleanup only.
  }
}

export async function sendQuestionReviewTimeoutMessage(
  client: HookClient,
  roomId: string,
): Promise<void> {
  try {
    await client.api.rooms[':id'].messages.$post({
      param: { id: roomId },
      json: {
        sender: 'hook',
        content: '_Question timed out — answer in terminal instead._',
        sender_type: 'agent',
        color: '#f59e0b',
      },
    })
  } catch {
    // Best-effort notification only.
  }
}

export async function requestRoomQuestionReview(
  client: HookClient,
  roomId: string,
  questions: QuestionReviewQuestion[],
  opts?: {
    formattedContent?: string
    pollInterval?: number
    pollTimeout?: number
  },
): Promise<QuestionReviewResult> {
  const formattedContent = opts?.formattedContent ?? formatQuestionReviewContent(questions)
  const created = await createQuestionReview(client, roomId, questions, formattedContent)
  if (!created.ok) return { status: 'failed' }

  const result = await pollForQuestionReviewAnswer(
    client,
    roomId,
    created.review.id,
    opts?.pollInterval,
    opts?.pollTimeout,
  )

  if (!result) {
    await expireQuestionReview(client, roomId, created.review.id)
    await sendQuestionReviewTimeoutMessage(client, roomId)
    return { status: 'timeout' }
  }

  if (result.status !== 'answered' || !result.answers_json) {
    return { status: result.status === 'expired' ? 'expired' : 'failed' }
  }

  try {
    return {
      status: 'answered',
      answers: JSON.parse(result.answers_json) as Record<string, string>,
    }
  } catch {
    return { status: 'failed' }
  }
}
