#!/usr/bin/env node
import { findRoomId } from '../log-tool-use/find-room'
import { createHookClient } from '../log-tool-use/client'

type Option = {
  label: string
  description?: string
  markdown?: string
}

type Question = {
  question: string
  header?: string
  options: Option[]
  multiSelect?: boolean
}

type AskUserInput = {
  session_id: string
  tool_name: string
  tool_input: {
    questions: Question[]
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

const POLL_INTERVAL_MS = 2000
const POLL_TIMEOUT_MS = 120_000

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
        text += '\n_Multiple choices allowed. Reply with numbers or labels separated by commas._'
      } else {
        text += '\n_Reply with a number or label._'
      }
      return text
    })
    .join('\n\n')
}

async function sendQuestion(client: ReturnType<typeof createHookClient>, roomId: string, content: string): Promise<string | null> {
  const res = await client.api.rooms[':id'].messages.$post({
    param: { id: roomId },
    json: {
      sender: 'hook',
      content,
      sender_type: 'agent' as const,
      color: '#f59e0b',
    },
  })
  if (!res.ok) {
    const text = await res.text()
    process.stderr.write(`[ask-user] send failed: ${res.status} ${text}\n`)
    return null
  }
  const data = await res.json()
  return data.id
}

async function pollForAnswer(
  client: ReturnType<typeof createHookClient>,
  roomId: string,
  afterMessageId: string,
): Promise<string | null> {
  const deadline = Date.now() + POLL_TIMEOUT_MS

  while (Date.now() < deadline) {
    try {
      const res = await client.api.rooms[':id'].messages.$get({
        param: { id: roomId },
        query: { after: afterMessageId, sender_type: 'human' },
      })
      if (res.ok) {
        const messages = (await res.json()) as { content: string }[]
        if (messages.length > 0) {
          return messages[0].content
        }
      }
    } catch (error) {
      process.stderr.write(`[ask-user] poll error: ${error}\n`)
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }

  return null
}

function resolveAnswer(answer: string, question: Question): string {
  const trimmed = answer.trim()

  // Try to match by number (1-indexed)
  const num = Number.parseInt(trimmed, 10)
  if (!Number.isNaN(num) && num >= 1 && num <= question.options.length) {
    return question.options[num - 1].label
  }

  // Try to match by label (case-insensitive)
  const match = question.options.find(
    (opt) => opt.label.toLowerCase() === trimmed.toLowerCase(),
  )
  if (match) return match.label

  // Fallback: return the raw answer
  return trimmed
}

function buildOutput(answer: string, questions: Question[]): HookOutput {
  const answers: Record<string, string> = {}
  for (const q of questions) {
    answers[q.question] = resolveAnswer(answer, q)
  }

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

export async function processAskUser(rawInput: string, teamsDir?: string): Promise<void> {
  let input: AskUserInput
  try {
    input = JSON.parse(rawInput)
  } catch {
    return
  }

  const { session_id: sessionId, tool_input: toolInput } = input
  if (!sessionId || !toolInput?.questions?.length) return

  const roomId = findRoomId(sessionId, teamsDir)
  if (!roomId) return

  const url = process.env.MEET_AI_URL
  const key = process.env.MEET_AI_KEY
  if (!url || !key) return

  const client = createHookClient(url, key)
  const content = formatQuestions(toolInput.questions)

  process.stderr.write(`[ask-user] sending question to room ${roomId} via ${url}\n`)
  const messageId = await sendQuestion(client, roomId, content)
  if (!messageId) return

  process.stderr.write(`[ask-user] question sent: ${messageId}, polling for answer...\n`)
  const answer = await pollForAnswer(client, roomId, messageId)
  if (!answer) {
    process.stderr.write(`[ask-user] timed out waiting for answer\n`)
    await sendQuestion(client, roomId, '_Question timed out — answer in terminal instead._')
    return
  }

  process.stderr.write(`[ask-user] got answer: ${answer}\n`)
  const output = buildOutput(answer, toolInput.questions)
  process.stdout.write(JSON.stringify(output))
}

// Main
async function main() {
  let input = ''
  for await (const chunk of process.stdin) {
    input += chunk
  }
  await processAskUser(input)
}

const isDirectExecution = process.argv[1]?.includes('/hooks/')
if (isDirectExecution && !process.argv[1]?.includes('vitest')) {
  main().catch((error) => {
    process.stderr.write(`[ask-user] fatal: ${error}\n`)
    process.exit(0)
  })
}
