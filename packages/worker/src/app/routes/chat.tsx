import { Toast } from '@base-ui/react/toast'
import { ClientOnly, createFileRoute, Outlet, useNavigate, useParams } from '@tanstack/react-router'
import { useState, useCallback, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
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
import * as api from '../lib/api'
import { ChatContext } from '../lib/chat-context'
import { STORAGE_KEYS, DEFAULT_SCHEMA } from '../lib/constants'
import { getOrCreateHandle } from '../lib/handle'
import { applySchema } from '../lib/theme'
import type { Room, TeamInfo, TasksInfo, CommandInfo } from '../lib/types'

export const Route = createFileRoute('/chat')({
  component: ChatPage,
})

function ChatPage() {
  return (
    <ClientOnly fallback={<ChatLoadingFallback />}>
      <ChatApp />
    </ClientOnly>
  )
}

function ChatApp() {
  const [apiKey, setApiKeyState] = useState<string | null>(() => api.getApiKey())
  const [userName, setUserName] = useLocalStorage(STORAGE_KEYS.handle, getOrCreateHandle())
  const [colorSchema, setColorSchema] = useLocalStorage(STORAGE_KEYS.colorSchema, DEFAULT_SCHEMA)

  const urlToken = new URLSearchParams(location.search).get('token')

  useEffect(() => {
    applySchema(colorSchema)
  }, [colorSchema])

  const handleLogin = useCallback((key: string) => {
    api.setApiKey(key)
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
      onNameChange={setUserName}
      onSchemaChange={handleSchemaChange}
    />
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
  const [rooms, setRooms] = useState<Room[]>([])
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showSpawnModal, setShowSpawnModal] = useState(false)
  const [showQRModal, setShowQRModal] = useState(false)
  const [showIOSInstallModal, setShowIOSInstallModal] = useState(false)
  const toastManager = Toast.useToastManager()
  const [teamInfo, setTeamInfo] = useState<TeamInfo | null>(null)
  const [tasksInfo, setTasksInfo] = useState<TasksInfo | null>(null)
  const [commandsInfo, setCommandsInfo] = useState<CommandInfo[] | null>(null)
  const [teamSidebarOpen, setTeamSidebarOpen] = useState(false)
  const [showTaskBoard, setShowTaskBoard] = useState(false)

  const isStandalone =
    (window.navigator as any).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches

  // Load rooms on mount
  useEffect(() => {
    let cancelled = false
    async function load() {
      const loaded = await api.loadRooms()
      if (!cancelled) setRooms(loaded)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const removeRoom = useCallback((id: string) => {
    setRooms(prev => prev.filter(r => r.id !== id))
  }, [])

  const navigate = useNavigate()
  const params = useParams({ strict: false }) as { id?: string }

  const handleDeleteRoom = useCallback(async (id: string) => {
    const room = rooms.find(r => r.id === id)
    try {
      await api.deleteRoom(id)
      removeRoom(id)
      toast.success(`"${room?.name}" deleted`)
      if (params.id === id) {
        navigate({ to: '/chat' })
      }
    } catch {
      toast.error('Failed to delete room. Please try again.')
    }
  }, [rooms, removeRoom, navigate, params.id])

  // Lobby WebSocket for new room events
  const onRoomCreated = useCallback((id: string, name: string) => {
    setRooms(prev => (prev.some(r => r.id === id) ? prev : [{ id, name }, ...prev]))
  }, [])
  const { send: lobbySend } = useLobbyWebSocket(apiKey, onRoomCreated)

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
      rooms,
      removeRoom,
      apiKey,
      userName,
      colorSchema,
      teamInfo,
      setTeamInfo,
      tasksInfo,
      setTasksInfo,
      commandsInfo,
      setCommandsInfo,
      teamSidebarOpen,
      setTeamSidebarOpen,
      onNameChange,
      onSchemaChange,
      showSettings: () => setShowSettingsModal(true),
      showQR: () => setShowQRModal(true),
      showIOSInstall: () => setShowIOSInstallModal(true),
      isStandalone,
    }),
    [
      rooms,
      removeRoom,
      apiKey,
      userName,
      colorSchema,
      teamInfo,
      tasksInfo,
      commandsInfo,
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
          userName={userName}
          onNameChange={onNameChange}
          onSettingsClick={() => setShowSettingsModal(true)}
          onSpawnClick={() => setShowSpawnModal(true)}
          onInstallClick={handleInstallClick}
          onDeleteRoom={handleDeleteRoom}
        />
        <SidebarInset className="bg-transparent">
          <Outlet />
        </SidebarInset>
        <TeamSidebar
          teamInfo={teamInfo}
          tasksInfo={tasksInfo}
          isOpen={teamSidebarOpen}
          onClose={() => setTeamSidebarOpen(false)}
          onOpenTaskBoard={() => setShowTaskBoard(true)}
        />
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
      {showTaskBoard && params.id && (
        <TaskBoardModal
          roomId={params.id}
          tasksInfo={tasksInfo}
          teamInfo={teamInfo}
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
