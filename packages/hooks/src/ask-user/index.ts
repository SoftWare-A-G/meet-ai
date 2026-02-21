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
    hookEventName: 'PreToolUse'
    permissionDecision: 'allow' | 'deny'
    permissionDecisionReason?: string
    additionalContext?: string
  }
}

const POLL_INTERVAL_MS = 2000
const POLL_TIMEOUT_MS = 120_000

function formatQuestions(questions: Question[]): string {
  return questions
    .map((q) => {
      let text = `**${q.question}**\n`
      q.options.forEach((opt, i) => {
        text += `${i + 1}. **${opt.label}**`
        if (opt.description) text += ` — ${opt.description}`
        text += '\n'
      })
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
    } catch (err) {
      process.stderr.write(`[ask-user] poll error: ${err}\n`)
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
  }

  return null
}

function buildOutput(answer: string, questions: Question[]): HookOutput {
  const context = questions
    .map((q) => {
      return `Question: "${q.question}"\nUser answered: ${answer}`
    })
    .join('\n\n')

  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason:
        'Question was answered by the user via meet-ai chat UI. Do NOT ask again. Use the answer from additionalContext.',
      additionalContext: context,
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
  main().catch((err) => {
    process.stderr.write(`[ask-user] fatal: ${err}\n`)
    process.exit(0)
  })
}
