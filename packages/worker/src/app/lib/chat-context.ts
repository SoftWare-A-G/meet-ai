import { createContext, useContext } from 'react'
import type { Room, TeamInfo, TasksInfo } from './types'

export type ChatContextValue = {
  rooms: Room[]
  apiKey: string
  userName: string
  colorSchema: string
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean | ((prev: boolean) => boolean)) => void
  teamInfo: TeamInfo | null
  setTeamInfo: (info: TeamInfo | null) => void
  tasksInfo: TasksInfo | null
  setTasksInfo: (info: TasksInfo | null) => void
  teamSidebarOpen: boolean
  setTeamSidebarOpen: (open: boolean | ((prev: boolean) => boolean)) => void
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
