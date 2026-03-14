#!/usr/bin/env bun
/**
 * Behavioral prompt test — verifies that an LLM, given our system/starting prompts,
 * can answer questions about meet-ai correctly.
 *
 * Run: bun packages/cli/test/prompts/behavioral-prompt-test.ts
 */

import { buildClaudeSystemPrompt } from '@meet-ai/cli/lib/prompts/claude-system-prompt'
import { buildClaudeStartingPrompt } from '@meet-ai/cli/lib/prompts/claude-starting-prompt'

const ROOM_ID = 'test-room-123'
const TIMEOUT_MS = 30_000
const MODEL = 'haiku'

interface TestCase {
  question: string
  /** At least one keyword group must match. Each group is an array of keywords that ALL must be present. */
  expectAny: string[][]
  /** Extra prompt text appended after the system prompt */
  extraPrompt?: string
}

// ---------------------------------------------------------------------------
// System prompt test cases
// ---------------------------------------------------------------------------
const systemPromptTests: TestCase[] = [
  {
    question: 'How do you send a message to the chat room?',
    expectAny: [['meet-ai send-message', '--color']],
  },
  {
    question: 'Should your CLI output match what you send to the chat room?',
    expectAny: [['identical'], ['same'], ['match']],
  },
  {
    question: 'How do you check the canvas state before making changes?',
    expectAny: [['get_canvas_state'], ['list_canvas_shapes']],
  },
  {
    question: 'What command sends available slash commands to the room?',
    expectAny: [['meet-ai send-commands']],
  },
  {
    question: 'How do you poll for new messages?',
    expectAny: [['meet-ai poll', '--exclude']],
  },
  {
    question: 'What format should you use for messages in the chat room?',
    expectAny: [['markdown']],
  },
  {
    question: 'Should you post progress updates while working?',
    expectAny: [['yes'], ['should'], ['must']],
  },
  {
    question: 'Can you do implementation work as the orchestrator?',
    expectAny: [['no'], ['never'], ['delegate']],
  },
  {
    question: 'How do you create shapes on the canvas?',
    expectAny: [['create_canvas_shapes']],
  },
  {
    question: 'Where do you read agent colors from?',
    expectAny: [['config.json'], ['teams']],
  },
]

// ---------------------------------------------------------------------------
// Starting prompt test cases (system + starting prompt combined)
// ---------------------------------------------------------------------------
const startingPromptText = buildClaudeStartingPrompt(ROOM_ID).join('\n')

const startingPromptTests: TestCase[] = [
  {
    question: 'What is the first thing you should do when you start?',
    expectAny: [['team'], ['agent-team']],
    extraPrompt: startingPromptText,
  },
  {
    question:
      'Do you need to create a new room, or is the room ID already provided?',
    expectAny: [['no'], ['already'], ['provided']],
    extraPrompt: startingPromptText,
  },
  {
    question:
      'What JSON file do you need to write to the teams directory during startup?',
    expectAny: [['meet-ai.json']],
    extraPrompt: startingPromptText,
  },
  {
    question: 'How do you start the inbox listener?',
    expectAny: [['meet-ai listen', '--team', '--inbox']],
    extraPrompt: startingPromptText,
  },
]

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

interface TestResult {
  question: string
  passed: boolean
  answer: string
  matchedKeywords?: string[]
  expectedAny: string[][]
}

async function runTest(
  systemPrompt: string,
  testCase: TestCase
): Promise<TestResult> {
  const fullPrompt = testCase.extraPrompt
    ? `${systemPrompt}\n\n${testCase.extraPrompt}`
    : systemPrompt

  const proc = Bun.spawn(
    [
      'claude',
      '-p',
      testCase.question,
      '--model',
      MODEL,
      '--append-system-prompt',
      fullPrompt,
    ],
    {
      stdout: 'pipe',
      stderr: 'pipe',
      env: { ...process.env },
    }
  )

  const timeoutId = setTimeout(() => {
    proc.kill()
  }, TIMEOUT_MS)

  const answer = await new Response(proc.stdout).text()
  clearTimeout(timeoutId)

  const answerLower = answer.toLowerCase()

  for (const keywordGroup of testCase.expectAny) {
    const allMatch = keywordGroup.every((kw) =>
      answerLower.includes(kw.toLowerCase())
    )
    if (allMatch) {
      return {
        question: testCase.question,
        passed: true,
        answer: answer.trim(),
        matchedKeywords: keywordGroup,
        expectedAny: testCase.expectAny,
      }
    }
  }

  return {
    question: testCase.question,
    passed: false,
    answer: answer.trim(),
    expectedAny: testCase.expectAny,
  }
}

async function main() {
  const systemPrompt = buildClaudeSystemPrompt(ROOM_ID)
  const allTests = [...systemPromptTests, ...startingPromptTests]

  console.log(`\n🧪 Behavioral Prompt Tests`)
  console.log(`   Model: ${MODEL}`)
  console.log(`   Tests: ${allTests.length}`)
  console.log(`   Timeout: ${TIMEOUT_MS / 1000}s per test\n`)
  console.log('─'.repeat(70))

  const results: TestResult[] = []

  for (const testCase of allTests) {
    const label = testCase.extraPrompt ? '[STARTING]' : '[SYSTEM]'
    process.stdout.write(`${label} ${testCase.question} ... `)

    const result = await runTest(systemPrompt, testCase)
    results.push(result)

    if (result.passed) {
      console.log(`✅ PASS (matched: ${result.matchedKeywords?.join(', ')})`)
    } else {
      console.log(`❌ FAIL`)
      console.log(`   Expected any of: ${JSON.stringify(result.expectedAny)}`)
      console.log(
        `   Got: ${result.answer.substring(0, 200)}${result.answer.length > 200 ? '...' : ''}`
      )
    }
  }

  console.log(`\n${'─'.repeat(70)}`)
  const passed = results.filter((r) => r.passed).length
  const failed = results.filter((r) => !r.passed).length
  console.log(`\nResults: ${passed} passed, ${failed} failed out of ${results.length}`)

  if (failed > 0) {
    console.log('\nFailed tests:')
    for (const r of results.filter((r) => !r.passed)) {
      console.log(`  - ${r.question}`)
    }
    process.exit(1)
  }

  console.log('\nAll tests passed!')
}

main()
