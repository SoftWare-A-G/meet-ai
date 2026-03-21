import { getClient, getContainer } from '@meet-ai/cli/domain/bootstrap'
import { err } from '@meet-ai/cli/lib/output'
import { getMeetAiRuntime } from '@meet-ai/cli/runtime'
import { defineCommand } from 'citty'
import { listenClaude } from './listen-claude'
import { listenCodex } from './listen-codex'
import { listenPi } from './listen-pi'
import { listenOpencode } from './listen-opencode'

export default defineCommand({
  meta: {
    name: 'listen',
    description: 'Stream messages via WebSocket',
  },
  args: {
    roomId: {
      type: 'positional',
      description: 'Room ID to listen on',
      required: true,
    },
    exclude: {
      type: 'string',
      alias: 'e',
      description: 'Exclude messages from this sender',
    },
    'sender-type': {
      type: 'string',
      alias: 't',
      description: 'Filter by sender type (human|agent)',
    },
    team: {
      type: 'string',
      alias: 'T',
      description: 'Team name for inbox routing',
    },
    inbox: {
      type: 'string',
      alias: 'i',
      description: 'Inbox name for routing (requires --team)',
    },
  },
  run({ args }) {
    try {
      const client = getClient()
      const container = getContainer()
      const input = {
        roomId: args.roomId,
        exclude: args.exclude,
        senderType: args['sender-type'],
        team: args.team,
        inbox: args.inbox,
      }

      // This is long-running — the WebSocket keeps the process alive until killed
      if (getMeetAiRuntime() === 'codex') {
        listenCodex(client, input)
        return
      }

      if (getMeetAiRuntime() === 'pi') {
        listenPi(client, input)
        return
      }

      if (getMeetAiRuntime() === 'opencode') {
        void listenOpencode(client, input)
        return
      }

      listenClaude(client, input, container.inboxRouter)
    } catch (error) {
      err(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  },
})
