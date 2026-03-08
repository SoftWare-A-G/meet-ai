import { readFileSync } from 'node:fs'
import { TmuxClient } from '@meet-ai/cli/lib/tmux-client'
import type IInboxRouter from '@meet-ai/cli/domain/interfaces/IInboxRouter'
import type { MeetAiClient, Message } from '@meet-ai/cli/types'

export type ListenMessage = Message & {
  room_id?: string
  attachment_count?: number
  type?: string
  paneId?: string
  cols?: number
}

export function loadTeamExcludeSet(teamName?: string): Set<string> {
  if (!teamName) return new Set()
  const configPath = `${process.env.HOME}/.claude/teams/${teamName}/config.json`
  let raw: string
  try {
    raw = readFileSync(configPath, 'utf-8')
  } catch {
    // Config doesn't exist yet — team may still be initializing
    return new Set()
  }
  let config: { members?: { name: string }[] }
  try {
    config = JSON.parse(raw)
  } catch {
    console.error(`Error: Malformed JSON in team config at ${configPath}`)
    process.exit(1)
  }
  return new Set(config.members?.map(m => m.name) || [])
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
          const fs = require('node:fs') as typeof import('node:fs')
          const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
          const members = (config.members || []) as { name: string; tmuxPaneId?: string }[]
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
