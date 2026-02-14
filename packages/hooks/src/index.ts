#!/usr/bin/env node
import { readFileSync, writeFileSync, statSync, rmSync } from 'node:fs'
import { findRoomId } from './find-room'
import { summarize } from './summarize'
import { createHookClient, sendParentMessage, sendLogEntry } from './client'
import type { HookInput } from './types'

const PARENT_MSG_TTL_SEC = 120

function getOrCreateParentId(sessionId: string): string | null {
  const path = `/tmp/meet-ai-hook-${sessionId}.msgid`
  try {
    const mtime = statSync(path).mtimeMs
    if (Date.now() - mtime > PARENT_MSG_TTL_SEC * 1000) {
      rmSync(path, { force: true })
      return null
    }
    return readFileSync(path, 'utf-8').trim() || null
  } catch {
    return null
  }
}

function saveParentId(sessionId: string, msgId: string) {
  writeFileSync(`/tmp/meet-ai-hook-${sessionId}.msgid`, msgId)
}

export async function processHookInput(rawInput: string, teamsDir?: string): Promise<'sent' | 'skip'> {
  let input: HookInput
  try {
    input = JSON.parse(rawInput)
  } catch {
    return 'skip'
  }

  const { session_id: sessionId, tool_name: toolName, tool_input: toolInput = {} } = input
  if (!sessionId || !toolName) return 'skip'

  // Skip SendMessage — internal agent communication
  if (toolName === 'SendMessage') return 'skip'

  // Skip Bash cd and meet-ai commands (avoid recursion)
  if (toolName === 'Bash') {
    const cmd = typeof toolInput.command === 'string' ? toolInput.command : ''
    if (cmd.startsWith('cd ') || cmd.startsWith('meet-ai ')) return 'skip'
  }

  // Find room
  const roomId = findRoomId(sessionId, teamsDir)
  if (!roomId) return 'skip'

  // Need env vars
  const url = process.env.MEET_AI_URL
  const key = process.env.MEET_AI_KEY
  if (!url || !key) return 'skip'

  const client = createHookClient(url, key)
  const summary = summarize(toolName, toolInput as Record<string, unknown>)

  // Get or create parent message
  let parentId = getOrCreateParentId(sessionId)
  if (!parentId) {
    parentId = await sendParentMessage(client, roomId)
    if (parentId) saveParentId(sessionId, parentId)
  }

  // Send log entry
  await sendLogEntry(client, roomId, summary, parentId ?? undefined)

  return 'sent'
}

// Main: read stdin and run
async function main() {
  let input = ''
  for await (const chunk of process.stdin) {
    input += chunk
  }
  await processHookInput(input)
  process.exit(0)
}

// Only run main when executed directly (not imported by tests)
const isDirectExecution = process.argv[1]?.includes('/hooks/')
if (isDirectExecution && !process.argv[1]?.includes('vitest')) {
  main().catch(() => process.exit(0))
}
