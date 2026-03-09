import { IDLE_CHECK_INTERVAL_MS } from '@meet-ai/cli/inbox-router'
import { downloadMessageAttachments } from '@meet-ai/cli/lib/attachments'
import {
  registerActiveTeamMember,
  type TeamMemberRegistrar,
} from '@meet-ai/cli/lib/team-member-registration'
import { ListenInput } from './schema'
import {
  createTerminalControlHandler,
  isHookAnchorMessage,
  loadTeamExcludeSet,
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
  teamMemberRegistrar: TeamMemberRegistrar = registerActiveTeamMember
): WebSocket {
  const parsed = ListenInput.parse(input)
  const { roomId, exclude, senderType, team, inbox } = parsed
  const teamExcludeSet = loadTeamExcludeSet(team)

  const inboxDir = team ? `${process.env.HOME}/.claude/teams/${team}/inboxes` : null
  const defaultInboxPath = inboxDir && inbox ? `${inboxDir}/${inbox}.json` : null
  const teamDir = team ? `${process.env.HOME}/.claude/teams/${team}` : undefined

  const terminal = createTerminalControlHandler({ client, roomId, teamDir, inboxRouter })

  const onMessage = (msg: ListenMessage) => {
    if (terminal.handle(msg)) return
    if (!isPlainChatMessage(msg)) return
    if (isHookAnchorMessage(msg)) return
    if (teamExcludeSet.has(msg.sender)) return

    if (msg.id && msg.room_id && (msg.attachment_count ?? 0) > 0) {
      void downloadMessageAttachments(client, msg.room_id, msg.id).then(paths => {
        const output = paths.length ? { ...msg, attachments: paths } : msg
        console.log(JSON.stringify(output))

        if (inboxDir && teamDir && inboxRouter) {
          inboxRouter.route(msg, {
            inboxDir,
            defaultInboxPath,
            teamDir,
            attachmentPaths: paths,
          })
        }
      })
      return
    }

    console.log(JSON.stringify(msg))
    if (inboxDir && teamDir && inboxRouter) {
      inboxRouter.route(msg, { inboxDir, defaultInboxPath, teamDir })
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
          inbox: inbox!,
          defaultInboxPath: defaultInboxPath ?? null,
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
