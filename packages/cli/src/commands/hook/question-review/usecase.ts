import { createHookClient } from '@meet-ai/cli/lib/hooks/client'
import { findRoomId } from '@meet-ai/cli/lib/hooks/find-room'
import {
  createQuestionReview,
  expireQuestionReview,
  formatQuestionReviewContent,
  pollForQuestionReviewAnswer,
  sendQuestionReviewTimeoutMessage,
  type QuestionReviewQuestion as Question,
} from '@meet-ai/cli/lib/question-review'

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

export async function processQuestionReview(
  rawInput: string,
  teamsDir?: string,
  opts?: { pollInterval?: number; pollTimeout?: number }
): Promise<void> {
  let input: AskUserInput
  try {
    input = JSON.parse(rawInput)
  } catch {
    process.stderr.write('[question-review] failed to parse stdin\n')
    return
  }

  const {
    session_id: sessionId,
    transcript_path: transcriptPath,
    hook_event_name: hookEventName,
    tool_input: toolInput,
  } = input
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
  const formattedContent = formatQuestionReviewContent(toolInput.questions)

  process.stderr.write(`[question-review] sending question to room ${roomId} via ${url}\n`)
  const created = await createQuestionReview(client, roomId, toolInput.questions, formattedContent)
  if (!created.ok) {
    if (created.error) {
      process.stderr.write(`[question-review] create error: ${created.error}\n`)
    } else {
      process.stderr.write(
        `[question-review] create failed: ${created.status} ${created.text ?? ''}\n`
      )
    }
    return
  }

  process.stderr.write(`[question-review] created: ${created.review.id}, polling for answer...\n`)
  const result = await pollForQuestionReviewAnswer(
    client,
    roomId,
    created.review.id,
    opts?.pollInterval,
    opts?.pollTimeout
  )

  if (!result) {
    process.stderr.write('[question-review] timed out waiting for answer\n')
    await expireQuestionReview(client, roomId, created.review.id)
    await sendQuestionReviewTimeoutMessage(client, roomId)
    return
  }

  process.stderr.write(`[question-review] answer received: ${result.status}\n`)

  if (result.status === 'answered' && result.answers_json) {
    try {
      process.stdout.write(
        JSON.stringify(
          buildOutput(
            toolInput.questions,
            JSON.parse(result.answers_json) as Record<string, string>
          )
        )
      )
    } catch (error) {
      process.stderr.write(`[question-review] failed to parse answers_json: ${error}\n`)
    }
  }
  // If expired, output nothing — falls through to terminal prompt
}
