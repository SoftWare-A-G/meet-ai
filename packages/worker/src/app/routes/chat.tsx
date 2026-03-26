import { Toast } from '@base-ui/react/toast'
import { createFileRoute, Outlet, redirect, useParams } from '@tanstack/react-router'
import { useState, useCallback } from 'react'
import { z } from 'zod/v4'
import IOSInstallModal from '../components/IOSInstallModal'
import LoginPrompt from '../components/LoginPrompt'
import QRShareModal from '../components/QRShareModal'
import SettingsModal from '../components/SettingsModal'
import Sidebar from '../components/Sidebar'
import SpawnTeamModal from '../components/SpawnTeamModal'
import TaskBoardModal from '../components/TaskBoardModal'
import TeamSidebar from '../components/TeamSidebar'
import TokenScreen from '../components/TokenScreen'
import { SidebarProvider, SidebarInset } from '../components/ui/sidebar'
import { useLobbyWebSocket } from '../hooks/useLobbyWebSocket'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useProjectsQuery } from '../hooks/useProjectsQuery'
import { useRoomsQuery } from '../hooks/useRoomsQuery'
import { getApiKey, setApiKey } from '../lib/api'
import { STORAGE_KEYS, DEFAULT_SCHEMA, DEFAULT_FONT_SCALE } from '../lib/constants'
import { getOrCreateHandle } from '../lib/handle'
import { roomsQueryOptions, projectsQueryOptions } from '../lib/query-options'
import { applySchema, applyFontScale } from '../lib/theme'
import { useChatShellStore } from '../stores/useChatShellStore'

const chatSearchSchema = z.object({
  token: z.string().optional().catch(undefined),
})

export const Route = createFileRoute('/chat')({
  head: () => ({ meta: [{ name: 'robots', content: 'noindex, follow' }] }),
  component: ChatPage,
  validateSearch: chatSearchSchema,
  ssr: false, // Since our token lives in localStorage only
  beforeLoad: ({ search }) => {
    // Just a guardrail against localStorage on server
    if (typeof window === 'undefined') return { apiKey: null }

    const apiKey = getApiKey()
    if (!apiKey && !search.token) {
      throw redirect({ to: '/key' })
    }

    return { apiKey }
  },
  loader: async ({ context: { queryClient, apiKey } }) => {
    if (!apiKey) {
      return
    }

    const [rooms, projects] = await Promise.all([
      queryClient.ensureQueryData(roomsQueryOptions),
      queryClient.ensureQueryData(projectsQueryOptions),
    ])

    return { rooms, projects }
  },
  pendingComponent: () => (
    <div className="bg-chat-bg text-msg-text flex h-dvh min-w-0 flex-1 flex-col items-center justify-center">
      <div className="text-[#888]">Loading chats...</div>
    </div>
  ),
})

function ChatPage() {
  const { apiKey: initialApiKey } = Route.useRouteContext()
  const { token: urlToken } = Route.useSearch()
  const [apiKey, setApiKeyState] = useState<string | null>(initialApiKey)
  const [userName, setUserName] = useLocalStorage(STORAGE_KEYS.handle, getOrCreateHandle())
  const [colorSchema, setColorSchema] = useLocalStorage(STORAGE_KEYS.colorSchema, DEFAULT_SCHEMA)
  const [fontScale, setFontScale] = useLocalStorage(STORAGE_KEYS.fontScale, DEFAULT_FONT_SCALE)

  const handleLogin = useCallback((key: string) => {
    setApiKey(key)
    setApiKeyState(key)
    history.replaceState(null, '', '/chat')
    location.reload()
  }, [])

  const handleSchemaChange = useCallback(
    (schema: string) => {
      setColorSchema(schema)
      applySchema(schema)
    },
    [setColorSchema]
  )

  if (urlToken && apiKey) {
    history.replaceState(null, '', location.pathname)
  }

  if (urlToken && !apiKey) {
    return <TokenScreen token={urlToken} onLogin={handleLogin} />
  }

  if (!apiKey) {
    return <LoginPrompt onLogin={handleLogin} />
  }

  return (
    <ChatLayout
      apiKey={apiKey}
      userName={userName}
      colorSchema={colorSchema}
      fontScale={fontScale}
      onNameChange={setUserName}
      onSchemaChange={handleSchemaChange}
      onFontScaleChange={setFontScale}
    />
  )
}

type ChatLayoutProps = {
  apiKey: string
  userName: string
  colorSchema: string
  fontScale: string
  onNameChange: (name: string) => void
  onSchemaChange: (schema: string) => void
  onFontScaleChange: (scale: string) => void
}

function ChatLayout({
  apiKey,
  userName,
  colorSchema,
  fontScale,
  onNameChange,
  onSchemaChange,
  onFontScaleChange,
}: ChatLayoutProps) {
  const { data: rooms = [], isLoading: roomsLoading, error: roomsError } = useRoomsQuery()
  const {
    data: projects = [],
    isLoading: projectsLoading,
    error: projectsError,
  } = useProjectsQuery()
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showSpawnModal, setShowSpawnModal] = useState(false)
  const [showIOSInstallModal, setShowIOSInstallModal] = useState(false)
  const toastManager = Toast.useToastManager()
  const teamSidebarOpen = useChatShellStore(s => s.teamSidebarOpen)
  const setTeamSidebarOpen = useChatShellStore(s => s.setTeamSidebarOpen)
  const qrModalOpen = useChatShellStore(s => s.qrModalOpen)
  const hideQR = useChatShellStore(s => s.hideQR)
  const [showTaskBoard, setShowTaskBoard] = useState(false)
  const roomId = useParams({ from: '/chat/$id', shouldThrow: false })?.id
  const { send: lobbySend } = useLobbyWebSocket(apiKey)

  const handleInstallClick = useCallback(() => {
    setShowIOSInstallModal(true)
  }, [])

  const handleSettingsSave = useCallback(
    (schema: string, scale: string) => {
      onSchemaChange(schema)
      onFontScaleChange(scale)
      applyFontScale(scale)
      setShowSettingsModal(false)
    },
    [onSchemaChange, onFontScaleChange]
  )

  return (
    <>
      <SidebarProvider defaultOpen className="h-dvh min-h-0">
        <Sidebar
          rooms={rooms}
          projects={projects}
          activeRoomId={roomId}
          isLoading={roomsLoading || projectsLoading}
          error={roomsError ?? projectsError}
          userName={userName}
          onNameChange={onNameChange}
          onSettingsClick={() => setShowSettingsModal(true)}
          onSpawnClick={() => setShowSpawnModal(true)}
          onInstallClick={handleInstallClick}
        />
        <SidebarInset className="bg-transparent">
          <Outlet />
        </SidebarInset>
        {roomId && (
          <TeamSidebar
            roomId={roomId}
            isOpen={teamSidebarOpen}
            onClose={() => setTeamSidebarOpen(false)}
            onOpenTaskBoard={() => setShowTaskBoard(true)}
          />
        )}
      </SidebarProvider>
      {showSettingsModal && (
        <SettingsModal
          currentSchema={colorSchema}
          currentFontScale={fontScale}
          onSave={handleSettingsSave}
          onClose={() => setShowSettingsModal(false)}
        />
      )}
      {qrModalOpen && (
        <QRShareModal
          onClose={hideQR}
          onToast={text => {
            toastManager.add({ description: text })
            hideQR()
          }}
        />
      )}
      {showSpawnModal && (
        <SpawnTeamModal onClose={() => setShowSpawnModal(false)} onSend={lobbySend} />
      )}
      {showIOSInstallModal && <IOSInstallModal onClose={() => setShowIOSInstallModal(false)} />}
      {showTaskBoard && roomId && (
        <TaskBoardModal roomId={roomId} onClose={() => setShowTaskBoard(false)} />
      )}
    </>
  )
}
