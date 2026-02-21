#!/usr/bin/env node
import { findRoomId } from '../log-tool-use/find-room'
import { createHookClient } from '../log-tool-use/client'

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
  roomId: string,
  questions: Question[],
  formattedContent: string,
): Promise<QuestionReviewResponse | null> {
  try {
    const res = await fetch(`${process.env.MEET_AI_URL}/api/rooms/${roomId}/question-reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.MEET_AI_KEY}`,
      },
      body: JSON.stringify({
        questions_json: JSON.stringify(questions),
        formatted_content: formattedContent,
      }),
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
  roomId: string,
  reviewId: string,
): Promise<QuestionReviewStatus | null> {
  const deadline = Date.now() + POLL_TIMEOUT_MS

  while (Date.now() < deadline) {
    try {
      const res = await fetch(
        `${process.env.MEET_AI_URL}/api/rooms/${roomId}/question-reviews/${reviewId}`,
        {
          headers: { Authorization: `Bearer ${process.env.MEET_AI_KEY}` },
        }
      )
      if (res.ok) {
        const data = (await res.json()) as QuestionReviewStatus
        if (data.status !== 'pending') {
          return data
        }
      }
    } catch (error) {
      process.stderr.write(`[question-review] poll error: ${error}\n`)
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
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

async function expireReview(roomId: string, reviewId: string): Promise<void> {
  try {
    await fetch(
      `${process.env.MEET_AI_URL}/api/rooms/${roomId}/question-reviews/${reviewId}/expire`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.MEET_AI_KEY}` },
      }
    )
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
        content: '_Question timed out — answer in terminal instead._',
        sender_type: 'agent' as const,
        color: '#f59e0b',
      },
    })
  } catch {
    // Never throw — hook must not block the agent
  }
}

export async function processQuestionReview(rawInput: string, teamsDir?: string): Promise<void> {
  let input: AskUserInput
  try {
    input = JSON.parse(rawInput)
  } catch {
    process.stderr.write('[question-review] failed to parse stdin\n')
    return
  }

  const { session_id: sessionId, hook_event_name: hookEventName, tool_input: toolInput } = input
  if (!sessionId || !toolInput?.questions?.length) {
    process.stderr.write('[question-review] missing session_id or questions\n')
    return
  }

  process.stderr.write(`[question-review] triggered by ${hookEventName} event\n`)

  const roomId = findRoomId(sessionId, teamsDir)
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
  const review = await createQuestionReview(roomId, toolInput.questions, formattedContent)
  if (!review) return

  process.stderr.write(`[question-review] created: ${review.id}, polling for answer...\n`)
  const result = await pollForAnswer(roomId, review.id)

  if (!result) {
    process.stderr.write('[question-review] timed out waiting for answer\n')
    await expireReview(roomId, review.id)
    await sendTimeoutMessage(client, roomId)
    return
  }

  process.stderr.write(`[question-review] answer received: ${result.status}\n`)

  if (result.status === 'answered' && result.answers_json) {
    const answers: Record<string, string> = JSON.parse(result.answers_json)
    process.stdout.write(JSON.stringify(buildOutput(toolInput.questions, answers)))
  }
  // If expired, output nothing — falls through to terminal prompt
}

// Main
async function main() {
  let input = ''
  for await (const chunk of process.stdin) {
    input += chunk
  }
  await processQuestionReview(input)
}

const isDirectExecution = process.argv[1]?.includes('/hooks/')
if (isDirectExecution && !process.argv[1]?.includes('vitest')) {
  main().catch((error) => {
    process.stderr.write(`[question-review] fatal: ${error}\n`)
    process.exit(0)
  })
}
