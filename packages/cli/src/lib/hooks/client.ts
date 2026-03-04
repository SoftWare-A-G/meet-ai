import { hc } from 'hono/client'
import type { AppType } from '../../../../worker/src/index'

const HOOK_COLOR = '#6b7280'
const HOOK_SENDER = 'hook'

export type HookClient = ReturnType<typeof hc<AppType>>

export function createHookClient(url: string, key: string): HookClient {
  return hc<AppType>(url, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
  })
}

export async function sendParentMessage(client: HookClient, roomId: string): Promise<string | null> {
  try {
    const res = await client.api.rooms[':id'].messages.$post({
      param: { id: roomId },
      json: {
        sender: HOOK_SENDER,
        content: 'Agent activity',
        sender_type: 'agent',
        color: HOOK_COLOR,
      },
    })
    if (!res.ok) return null
    const data = (await res.json()) as { id: string }
    return data.id
  } catch {
    return null
  }
}

export async function sendLogEntry(
  client: HookClient,
  roomId: string,
  summary: string,
  messageId?: string,
): Promise<void> {
  try {
    await client.api.rooms[':id'].logs.$post({
      param: { id: roomId },
      json: {
        sender: HOOK_SENDER,
        content: summary,
        color: HOOK_COLOR,
        ...(messageId ? { message_id: messageId } : {}),
      },
    })
  } catch {
    // Never throw — hook must not block the agent
  }
}
