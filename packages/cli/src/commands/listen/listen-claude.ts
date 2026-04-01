import { IDLE_CHECK_INTERVAL_MS } from '@meet-ai/cli/inbox-router'
import { downloadMessageAttachments } from '@meet-ai/cli/lib/attachments'
import { appendRoomUsernames } from '@meet-ai/cli/lib/room-config'
import {
  registerActiveTeamMember,
  type TeamMemberRegistrar,
} from '@meet-ai/cli/lib/team-member-registration'
import { ListenInput } from './schema'
import {
  createTeamExcludeChecker,
  createTerminalControlHandler,
  isHookAnchorMessage,
  shouldDeliverMessage,
  type ListenMessage,
} from './shared'
import type IInboxRouter from '@meet-ai/cli/domain/interfaces/IInboxRouter'
import type { MeetAiClient } from '@meet-ai/cli/types'

function isPlainChatMessage(msg: ListenMessage): boolean {
  return msg.type == null || msg.type === 'message'
}

export function listenClaude(
  client: MeetAiClient,
  input: {
    roomId?: string
    exclude?: string
    senderType?: string
    team?: string
    inbox?: string
  },
  inboxRouter?: IInboxRouter,
  teamMemberRegistrar: TeamMemberRegistrar = registerActiveTeamMember,
  writeOutput: (data: string) => void = data => process.stdout.write(`${data}\n`)
): WebSocket {
  const parsed = ListenInput.parse(input)
  const { roomId, senderType, team, inbox } = parsed
  const exclude = parsed.exclude ?? inbox
  const isTeamExcluded = createTeamExcludeChecker(roomId, team, inbox)

  const inboxDir = team ? `${process.env.HOME}/.claude/teams/${team}/inboxes` : null
  const teamDir = team ? `${process.env.HOME}/.claude/teams/${team}` : undefined

  const terminal = createTerminalControlHandler({ client, roomId, teamDir, inboxRouter })

  const onMessage = (msg: ListenMessage) => {
    if (msg.type === 'room_deleted') {
      console.error(`Room ${roomId} was deleted. Exiting.`)
      shutdown()
      return
    }
    if (terminal.handle(msg)) return
    if (!isPlainChatMessage(msg)) return
    if (isHookAnchorMessage(msg)) return
    appendRoomUsernames(roomId, [msg.sender])
    if (isTeamExcluded(msg.sender)) return

    if (!shouldDeliverMessage(roomId, msg.content, inbox)) return

    if (msg.id && msg.room_id && (msg.attachment_count ?? 0) > 0) {
      void downloadMessageAttachments(client, msg.room_id, msg.id).then(paths => {
        const output = paths.length ? { ...msg, attachments: paths } : msg
        writeOutput(JSON.stringify(output))

        if (inboxDir && inbox && teamDir && inboxRouter) {
          inboxRouter.route(msg, {
            inboxDir,
            inbox,
            teamDir,
            roomId,
            attachmentPaths: paths,
          })
        }
      })

      return
    }

    writeOutput(JSON.stringify(msg))
    if (inboxDir && inbox && teamDir && inboxRouter) {
      inboxRouter.route(msg, { inboxDir, inbox, teamDir, roomId })
    }
  }

  const ws = client.listen(roomId, { exclude, senderType, onMessage })
  void teamMemberRegistrar({ roomId, teamName: team, agentName: inbox })

  let idleCheckTimeout: ReturnType<typeof setTimeout> | null = null
  const idleNotified = new Set<string>()

  if (inboxDir && inbox && teamDir && inboxRouter) {
    function scheduleIdleCheck() {
      idleCheckTimeout = setTimeout(() => {
        inboxRouter!.checkIdle({
          inboxDir: inboxDir!,
          teamDir: teamDir!,
          roomId,
          inbox: inbox!,
          notified: idleNotified,
        })
        scheduleIdleCheck()
      }, IDLE_CHECK_INTERVAL_MS)
    }
    scheduleIdleCheck()
  }

  function shutdown() {
    if (idleCheckTimeout) clearTimeout(idleCheckTimeout)
    terminal.shutdown()
    if (ws.readyState === WebSocket.OPEN) {
      ws.close(1000, 'client shutdown')
    }
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
  process.on('SIGHUP', shutdown)

  return ws
}
