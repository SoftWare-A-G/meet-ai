import { Toast } from '@base-ui/react/toast'
import { ClientOnly, createFileRoute, Outlet, useParams } from '@tanstack/react-router'
import { useState, useCallback, useEffect, useMemo } from 'react'
import IOSInstallModal from '../components/IOSInstallModal'
import LoginPrompt from '../components/LoginPrompt'
import QRShareModal from '../components/QRShareModal'
import QueryErrorBoundary from '../components/QueryErrorBoundary'
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
import { ChatContext } from '../lib/chat-context'
import { STORAGE_KEYS, DEFAULT_SCHEMA } from '../lib/constants'
import { getOrCreateHandle } from '../lib/handle'
import { applySchema } from '../lib/theme'

export const Route = createFileRoute('/chat')({
  component: ChatPage,
  head: () => ({
    meta: [{ name: 'robots', content: 'noindex, follow' }],
  }),
})

function ChatPage() {
  return (
    <ClientOnly fallback={<ChatLoadingFallback />}>
      <ChatApp />
    </ClientOnly>
  )
}

function ChatApp() {
  const [apiKey, setApiKeyState] = useState<string | null>(() => getApiKey())
  const [userName, setUserName] = useLocalStorage(STORAGE_KEYS.handle, getOrCreateHandle())
  const [colorSchema, setColorSchema] = useLocalStorage(STORAGE_KEYS.colorSchema, DEFAULT_SCHEMA)

  const urlToken = new URLSearchParams(location.search).get('token')

  useEffect(() => {
    applySchema(colorSchema)
  }, [colorSchema])

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
    <QueryErrorBoundary>
      <ChatLayout
        apiKey={apiKey}
        userName={userName}
        colorSchema={colorSchema}
        onNameChange={setUserName}
        onSchemaChange={handleSchemaChange}
      />
    </QueryErrorBoundary>
  )
}

type ChatLayoutProps = {
  apiKey: string
  userName: string
  colorSchema: string
  onNameChange: (name: string) => void
  onSchemaChange: (schema: string) => void
}

function ChatLayout({
  apiKey,
  userName,
  colorSchema,
  onNameChange,
  onSchemaChange,
}: ChatLayoutProps) {
  const { data: rooms = [], isLoading: roomsLoading, error: roomsError } = useRoomsQuery()
  const { data: projects = [], isLoading: projectsLoading, error: projectsError } = useProjectsQuery()
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showSpawnModal, setShowSpawnModal] = useState(false)
  const [showQRModal, setShowQRModal] = useState(false)
  const [showIOSInstallModal, setShowIOSInstallModal] = useState(false)
  const toastManager = Toast.useToastManager()
  const [teamSidebarOpen, setTeamSidebarOpen] = useState(false)
  const [showTaskBoard, setShowTaskBoard] = useState(false)
  const roomId = useParams({ from: '/chat/$id', shouldThrow: false })?.id

  const isStandalone =
    (window.navigator as any).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches

  const { send: lobbySend } = useLobbyWebSocket(apiKey)

  const handleInstallClick = useCallback(() => {
    setShowIOSInstallModal(true)
  }, [])

  const handleSettingsSave = useCallback(
    (schema: string) => {
      onSchemaChange(schema)
      setShowSettingsModal(false)
    },
    [onSchemaChange]
  )

  const ctx = useMemo(
    () => ({
      apiKey,
      userName,
      colorSchema,
      teamSidebarOpen,
      setTeamSidebarOpen,
      insertMention: (name: string) => {
        window.dispatchEvent(new CustomEvent('meet-ai:insert-mention', { detail: { name } }))
      },
      onNameChange,
      onSchemaChange,
      showSettings: () => setShowSettingsModal(true),
      showQR: () => setShowQRModal(true),
      showIOSInstall: () => setShowIOSInstallModal(true),
      isStandalone,
    }),
    [
      apiKey,
      userName,
      colorSchema,
      teamSidebarOpen,
      onNameChange,
      onSchemaChange,
      isStandalone,
    ]
  )

  return (
    <ChatContext.Provider value={ctx}>
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
          onSave={handleSettingsSave}
          onClose={() => setShowSettingsModal(false)}
        />
      )}
      {showQRModal && (
        <QRShareModal
          onClose={() => setShowQRModal(false)}
          onToast={text => {
            toastManager.add({ description: text })
            setShowQRModal(false)
          }}
        />
      )}
      {showSpawnModal && (
        <SpawnTeamModal onClose={() => setShowSpawnModal(false)} onSend={lobbySend} />
      )}
      {showIOSInstallModal && <IOSInstallModal onClose={() => setShowIOSInstallModal(false)} />}
      {showTaskBoard && roomId && (
        <TaskBoardModal
          roomId={roomId}
          onClose={() => setShowTaskBoard(false)}
        />
      )}
    </ChatContext.Provider>
  )
}

function ChatLoadingFallback() {
  return (
    <div className="bg-chat-bg text-msg-text flex h-dvh min-w-0 flex-1 flex-col items-center justify-center">
      <div className="text-[#888]">Loading chat...</div>
    </div>
  )
}
