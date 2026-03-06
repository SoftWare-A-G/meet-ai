import { createHookClient, type HookClient } from '../../../lib/hooks/client'
import { findRoomId } from '../../../lib/hooks/find-room'

type Option = {
  label: string
  description?: string
}

type Question = {
  question: string
  header?: string
  options: Option[]
  multiSelect?: boolean
}

type AskUserInput = {
  session_id: string
  transcript_path?: string
  hook_event_name: string
  tool_name: string
  tool_input: {
    questions: Question[]
    answers?: Record<string, string>
  }
}

type HookOutput = {
  hookSpecificOutput: {
    hookEventName: 'PermissionRequest'
    decision: {
      behavior: 'allow'
      updatedInput: {
        questions: Question[]
        answers: Record<string, string>
      }
    }
  }
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

const POLL_INTERVAL_MS = 2000
const POLL_TIMEOUT_MS = 1_800_000 // 30 minutes

function formatQuestions(questions: Question[]): string {
  return questions
    .map((q) => {
      let text = `**${q.question}**\n`
      for (let i = 0; i < q.options.length; i++) {
        const opt = q.options[i]
        text += `${i + 1}. **${opt.label}**`
        if (opt.description) text += ` — ${opt.description}`
        text += '\n'
      }
      if (q.multiSelect) {
        text += '\n_Multiple choices allowed._'
      }
      return text
    })
    .join('\n\n')
}

async function createQuestionReview(
  client: HookClient,
  roomId: string,
  questions: Question[],
  formattedContent: string,
): Promise<QuestionReviewResponse | null> {
  try {
    const res = await client.api.rooms[':id']['question-reviews'].$post({
      param: { id: roomId },
      json: {
        questions_json: JSON.stringify(questions),
        formatted_content: formattedContent,
      },
    })
    if (!res.ok) {
      const text = await res.text()
      process.stderr.write(`[question-review] create failed: ${res.status} ${text}\n`)
      return null
    }
    return (await res.json()) as QuestionReviewResponse
  } catch (error) {
    process.stderr.write(`[question-review] create error: ${error}\n`)
    return null
  }
}

async function pollForAnswer(
  client: HookClient,
  roomId: string,
  reviewId: string,
  pollInterval = POLL_INTERVAL_MS,
  pollTimeout = POLL_TIMEOUT_MS,
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
    } catch (error) {
      process.stderr.write(`[question-review] poll error: ${error}\n`)
    }
    await new Promise((resolve) => setTimeout(resolve, pollInterval))
  }

  return null
}

function buildOutput(questions: Question[], answers: Record<string, string>): HookOutput {
  return {
    hookSpecificOutput: {
      hookEventName: 'PermissionRequest',
      decision: {
        behavior: 'allow',
        updatedInput: {
          questions,
          answers,
        },
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
    await client.api.rooms[':id']['question-reviews'][':reviewId'].expire.$post({
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
        content: '_Question timed out — answer in terminal instead._',
        sender_type: 'agent',
        color: '#f59e0b',
      },
    })
  } catch {
    // Never throw — hook must not block the agent
  }
}

export async function processQuestionReview(
  rawInput: string,
  teamsDir?: string,
  opts?: { pollInterval?: number; pollTimeout?: number },
): Promise<void> {
  let input: AskUserInput
  try {
    input = JSON.parse(rawInput)
  } catch {
    process.stderr.write('[question-review] failed to parse stdin\n')
    return
  }

  const { session_id: sessionId, transcript_path: transcriptPath, hook_event_name: hookEventName, tool_input: toolInput } = input
  if (!sessionId || !toolInput?.questions?.length) {
    process.stderr.write('[question-review] missing session_id or questions\n')
    return
  }

  process.stderr.write(`[question-review] triggered by ${hookEventName} event\n`)

  const roomId = await findRoomId(sessionId, teamsDir, transcriptPath)
  if (!roomId) {
    process.stderr.write('[question-review] no room found for session\n')
    return
  }

  const url = process.env.MEET_AI_URL
  const key = process.env.MEET_AI_KEY
  if (!url || !key) {
    process.stderr.write('[question-review] MEET_AI_URL or MEET_AI_KEY not set\n')
    return
  }

  const client = createHookClient(url, key)
  const formattedContent = formatQuestions(toolInput.questions)

  process.stderr.write(`[question-review] sending question to room ${roomId} via ${url}\n`)
  const review = await createQuestionReview(client, roomId, toolInput.questions, formattedContent)
  if (!review) return

  process.stderr.write(`[question-review] created: ${review.id}, polling for answer...\n`)
  const result = await pollForAnswer(
    client,
    roomId,
    review.id,
    opts?.pollInterval,
    opts?.pollTimeout,
  )

  if (!result) {
    process.stderr.write('[question-review] timed out waiting for answer\n')
    await expireReview(client, roomId, review.id)
    await sendTimeoutMessage(client, roomId)
    return
  }

  process.stderr.write(`[question-review] answer received: ${result.status}\n`)

  if (result.status === 'answered' && result.answers_json) {
    let answers: Record<string, string>
    try {
      answers = JSON.parse(result.answers_json)
    } catch (error) {
      process.stderr.write(`[question-review] failed to parse answers_json: ${error}\n`)
      return
    }
    process.stdout.write(JSON.stringify(buildOutput(toolInput.questions, answers)))
  }
  // If expired, output nothing — falls through to terminal prompt
}
