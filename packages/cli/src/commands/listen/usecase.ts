import { isCodexRuntime } from '@meet-ai/cli/runtime'
import { listenClaude } from './listen-claude'
import { listenCodex } from './listen-codex'
import type { CodexBridge } from '@meet-ai/cli/lib/codex-app-server'
import type IInboxRouter from '@meet-ai/cli/domain/interfaces/IInboxRouter'
import type { TeamMemberRegistrar } from '@meet-ai/cli/lib/team-member-registration'
import type { MeetAiClient } from '@meet-ai/cli/types'

export function listen(
  client: MeetAiClient,
  input: {
    roomId?: string
    exclude?: string
    senderType?: string
    team?: string
    inbox?: string
  },
  inboxRouter?: IInboxRouter,
  codexBridgeOverride?: CodexBridge | null,
  teamMemberRegistrar?: TeamMemberRegistrar
): WebSocket {
  // Keep a thin shared entrypoint for tests and internal callers.
  if (isCodexRuntime()) {
    return listenCodex(client, input, codexBridgeOverride, teamMemberRegistrar)
  }

  return listenClaude(client, input, inboxRouter, teamMemberRegistrar)
}
