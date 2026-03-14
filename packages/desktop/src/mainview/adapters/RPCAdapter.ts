import Electrobun, { Electroview } from 'electrobun/view'
import type { MeetAiRPCSchema } from '../../shared/rpc-schema'
import type { HandleLog } from '../domain/usecases/HandleLog'
import type { HandleMessage } from '../domain/usecases/HandleMessage'
import type { HandleTasks } from '../domain/usecases/HandleTasks'
import type { HandleTeamInfo } from '../domain/usecases/HandleTeamInfo'
import type { TeamMember, StoredTask } from '../types'

export interface RPCUsecases {
  handleTeamInfo: HandleTeamInfo
  handleMessage: HandleMessage
  handleLog: HandleLog
  handleTasks: HandleTasks
}

export function initRPC(usecases: RPCUsecases): void {
  const rpc = Electroview.defineRPC<MeetAiRPCSchema>({
    maxRequestTime: 10000,
    handlers: {
      requests: {},
      messages: {
        '*': (messageName: string, payload: unknown) => {
          console.log('[rpc:webview] Received:', messageName)
          const data = payload as Record<string, unknown>
          switch (messageName) {
            case 'meetai:team_info': {
              usecases.handleTeamInfo.execute(data as { team_name: string; members: TeamMember[] })
              break
            }
            case 'meetai:message': {
              usecases.handleMessage.execute(data as { sender: string; content: string })
              break
            }
            case 'meetai:log': {
              usecases.handleLog.execute(data as { sender: string; content: string })
              break
            }
            case 'meetai:tasks_info': {
              usecases.handleTasks.execute(data as { tasks: StoredTask[] })
              break
            }
          }
        },
      },
    },
  })

  console.log('[rpc:webview] Initializing Electroview + RPC…')
  try {
    new Electrobun.Electroview({ rpc })
    console.log('[rpc:webview] Electroview ready, handler registered')
  } catch (error) {
    console.error('[rpc:webview] Electroview init failed:', error)
  }
}
