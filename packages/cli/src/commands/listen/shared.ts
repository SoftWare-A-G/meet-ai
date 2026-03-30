import { readFileSync } from 'node:fs'
import { TmuxClient } from '@meet-ai/cli/lib/tmux-client'
import { appendRoomUsernames, getRoomUsernames } from '@meet-ai/cli/lib/room-config'
import type IInboxRouter from '@meet-ai/cli/domain/interfaces/IInboxRouter'
import type { MeetAiClient, Message } from '@meet-ai/cli/types'

/**
 * Determine whether a message should be delivered to this listener.
 *
 * The listener's identity comes from `MEET_AI_AGENT_NAME` env var:
 * - If set (Codex/Pi/OpenCode): filters messages to only deliver those
 *   that @mention this agent or are general (no known-member mentions).
 * - If not set (Claude team listener): always delivers — the InboxRouter
 *   handles internal routing to specific agent inboxes.
 *
 * Known room members come from room config via `getRoomUsernames(roomId)`.
 */
export function shouldDeliverMessage(
  roomId: string,
  content: string | undefined,
): boolean {
  if (typeof content !== 'string') return true
  const mentions = content.match(/@([\w-]+)/g)
  if (!mentions) return true

  const myName = process.env.MEET_AI_AGENT_NAME?.trim()
  if (!myName) return true

  const mentionedNames = [...new Set(mentions.map(m => m.slice(1)))]

  // Deliver if directly mentioned
  if (mentionedNames.includes(myName)) return true

  // Check whether any mention targets a known room member.
  // If it does → message is for another known agent → filter out.
  // If it doesn't → unknown mention → treat as general message → deliver.
  const knownMembers = getRoomUsernames(roomId)
  return !mentionedNames.some(name => knownMembers.has(name))
}

export type ListenMessage = Message & {
  room_id?: string
  attachment_count?: number
  type?: string
  paneId?: string
  cols?: number
}

const HOOK_ANCHOR_SENDER = 'hook'
const HOOK_ANCHOR_CONTENT = 'Agent activity'
const HOOK_ANCHOR_COLOR = '#6b7280'

export function isHookAnchorMessage(msg: ListenMessage): boolean {
  const isPlainMessage = msg.type == null || msg.type === 'message'
  return (
    isPlainMessage &&
    msg.sender === HOOK_ANCHOR_SENDER &&
    msg.content === HOOK_ANCHOR_CONTENT &&
    msg.color === HOOK_ANCHOR_COLOR
  )
}

function readTeamMemberNames(configPath: string): string[] {
  let raw: string
  try {
    raw = readFileSync(configPath, 'utf-8')
  } catch {
    return []
  }
  try {
    const config: { members?: { name: string }[] } = JSON.parse(raw)
    return (config.members ?? []).map(m => m.name).filter(Boolean)
  } catch {
    return []
  }
}

const TEAM_CACHE_TTL_MS = 5_000

/**
 * Create a function that checks whether a sender should be excluded.
 * Re-reads the team config periodically so that members added after the
 * listener started are still filtered.  The `inbox` name (the listener's
 * own agent identity) is *always* excluded regardless of the config.
 *
 * Only team config members and the inbox agent are excluded — NOT all room
 * usernames.  Including room usernames would also exclude human senders
 * (who get added to room config via appendRoomUsernames), silently dropping
 * their messages after the first cache refresh.
 */
export function createTeamExcludeChecker(
  roomId: string,
  teamName?: string,
  inbox?: string,
): (sender: string) => boolean {
  if (!teamName && !inbox) return () => false

  const configPath = teamName ? `${process.env.HOME}/.claude/teams/${teamName}/config.json` : null

  let cached: Set<string> = new Set()
  let lastRead = 0

  function refresh(): Set<string> {
    const now = Date.now()
    if (now - lastRead < TEAM_CACHE_TTL_MS && cached.size > 0) return cached
    lastRead = now

    const teamNames = configPath ? readTeamMemberNames(configPath) : []

    // Write back any team config members not yet persisted in per-room config.
    // This closes the gap where Claude subagents appear in the team config
    // after the listener started but the hook write-back failed or didn't fire.
    const roomNames = getRoomUsernames(roomId)
    const newFromTeam = teamNames.filter(name => !roomNames.has(name))
    if (newFromTeam.length > 0) {
      appendRoomUsernames(roomId, newFromTeam)
    }

    // Only exclude team config members and inbox — not room usernames
    const names = [...teamNames]
    if (inbox && !names.includes(inbox)) names.push(inbox)
    cached = new Set(names)
    return cached
  }

  // Initial load
  refresh()

  return (sender: string) => refresh().has(sender)
}

export function createTerminalControlHandler(input: {
  client: MeetAiClient
  roomId: string
  teamDir?: string
  inboxRouter?: IInboxRouter
}) {
  const { client, roomId, teamDir } = input
  const tmuxClient = new TmuxClient({ server: 'meet-ai', scrollback: 50000 })
  let terminalInterval: ReturnType<typeof setInterval> | null = null

  function handle(msg: ListenMessage): boolean {
    if (msg.type === 'terminal_resize') {
      const cols = msg.cols
      if (typeof cols === 'number' && cols > 0) {
        void tmuxClient.listAllPanes().then(allPanes => {
          const roomPrefix = roomId.slice(0, 8)
          const roomPanes = allPanes.filter(p => p.sessionName.includes(roomPrefix))
          for (const p of roomPanes) {
            tmuxClient.resizePane(p.paneId, cols)
          }
        })
      }
      return true
    }

    if (msg.type === 'terminal_subscribe') {
      const roomPrefix = roomId.slice(0, 8)
      let membersByPaneId: Record<string, string> = {}

      if (teamDir) {
        try {
          const configPath = `${teamDir}/config.json`
          const config: { members?: { name: string; tmuxPaneId?: string }[] } = JSON.parse(readFileSync(configPath, 'utf8'))
          const members = config.members || []
          for (const m of members) {
            if (m.tmuxPaneId) {
              membersByPaneId[m.tmuxPaneId] = m.name
            }
          }
        } catch {
          // Continue without config and use tmux titles as names.
        }
      }

      if (terminalInterval) {
        clearInterval(terminalInterval)
        terminalInterval = null
      }

      let lastSentPayload = ''
      const TERMINAL_POLL_MS = 500
      terminalInterval = setInterval(async () => {
        try {
          const allTmuxPanes = await tmuxClient.listAllPanes()
          const roomPanes = allTmuxPanes.filter(p => p.sessionName.includes(roomPrefix))
          if (roomPanes.length === 0) return

          const panes = roomPanes.map(tp => ({
            name: membersByPaneId[tp.paneId] || tp.title || tp.paneId,
            paneId: tp.paneId,
          }))

          panes.sort((a, b) => {
            if (a.name === 'team-lead') return -1
            if (b.name === 'team-lead') return 1
            return a.name.localeCompare(b.name)
          })

          const results = await Promise.all(
            panes.map(async p => {
              const lines = await tmuxClient.capturePane(p.paneId, 0)
              return { name: p.name, paneId: p.paneId, data: lines.join('\r\n') }
            })
          )

          const payload = JSON.stringify({ panes: results })
          if (payload === lastSentPayload) return
          lastSentPayload = payload
          await client.sendTerminalData(roomId, payload)
        } catch {
          // Gracefully ignore terminal stream errors.
        }
      }, TERMINAL_POLL_MS)

      return true
    }

    if (msg.type === 'terminal_unsubscribe') {
      if (terminalInterval) {
        clearInterval(terminalInterval)
        terminalInterval = null
      }
      return true
    }

    if (msg.type === 'terminal_data') {
      return true
    }

    return false
  }

  function shutdown() {
    if (terminalInterval) {
      clearInterval(terminalInterval)
      terminalInterval = null
    }
  }

  return { handle, shutdown }
}
