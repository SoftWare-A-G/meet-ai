import { createContext, useContext } from 'react'
import type { RoomsResponse, ProjectsResponse } from './fetchers'
import type { AgentActivity } from './activity'

export type ChatContextValue = {
  rooms: RoomsResponse
  projects: ProjectsResponse
  apiKey: string
  userName: string
  colorSchema: string
  agentActivity: Map<string, AgentActivity>
  setAgentActivity: (activity: Map<string, AgentActivity>) => void
  teamSidebarOpen: boolean
  setTeamSidebarOpen: (open: boolean | ((prev: boolean) => boolean)) => void
  insertMention: (name: string) => void
  onNameChange: (name: string) => void
  onSchemaChange: (schema: string) => void
  showSettings: () => void
  showQR: () => void
  showIOSInstall: () => void
  isStandalone: boolean
}

export const ChatContext = createContext<ChatContextValue | null>(null)

export function useChatContext() {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChatContext must be used within ChatContext.Provider')
  return ctx
}
