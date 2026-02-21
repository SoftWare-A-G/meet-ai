import { ClientOnly, createFileRoute, Outlet } from '@tanstack/react-router'
import { useState, useCallback, useEffect, useMemo } from 'react'
import IOSInstallModal from '../components/IOSInstallModal'
import LoginPrompt from '../components/LoginPrompt'
import QRShareModal from '../components/QRShareModal'
import SettingsModal from '../components/SettingsModal'
import Sidebar from '../components/Sidebar'
import TeamSidebar from '../components/TeamSidebar'
import { Toast } from '@base-ui/react/toast'
import TokenScreen from '../components/TokenScreen'
import { useLobbyWebSocket } from '../hooks/useLobbyWebSocket'
import { useLocalStorage } from '../hooks/useLocalStorage'
import * as api from '../lib/api'
import { ChatContext } from '../lib/chat-context'
import { STORAGE_KEYS, DEFAULT_SCHEMA } from '../lib/constants'
import { getOrCreateHandle } from '../lib/handle'
import { applySchema } from '../lib/theme'
import type { Room, TeamInfo, TasksInfo } from '../lib/types'

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
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showQRModal, setShowQRModal] = useState(false)
  const [showIOSInstallModal, setShowIOSInstallModal] = useState(false)
  const toastManager = Toast.useToastManager()
  const [teamInfo, setTeamInfo] = useState<TeamInfo | null>(null)
  const [tasksInfo, setTasksInfo] = useState<TasksInfo | null>(null)
  const [teamSidebarOpen, setTeamSidebarOpen] = useState(false)

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

  // Lobby WebSocket for new room events
  const onRoomCreated = useCallback((id: string, name: string) => {
    setRooms(prev => prev.some(r => r.id === id) ? prev : [{ id, name }, ...prev])
  }, [])
  useLobbyWebSocket(apiKey, onRoomCreated)

  const handleInstallClick = useCallback(() => {
    setSidebarOpen(false)
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
      apiKey,
      userName,
      colorSchema,
      sidebarOpen,
      setSidebarOpen,
      teamInfo,
      setTeamInfo,
      tasksInfo,
      setTasksInfo,
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
      apiKey,
      userName,
      colorSchema,
      sidebarOpen,
      teamInfo,
      tasksInfo,
      teamSidebarOpen,
      onNameChange,
      onSchemaChange,
      isStandalone,
    ]
  )

  return (
    <ChatContext.Provider value={ctx}>
      <div className="flex h-dvh">
        <Sidebar
          rooms={rooms}
          userName={userName}
          isOpen={sidebarOpen}
          onNameChange={onNameChange}
          onSettingsClick={() => setShowSettingsModal(true)}
          onClose={() => setSidebarOpen(false)}
          onInstallClick={handleInstallClick}
        />
        <Outlet />
        <TeamSidebar
          teamInfo={teamInfo}
          tasksInfo={tasksInfo}
          isOpen={teamSidebarOpen}
          onClose={() => setTeamSidebarOpen(false)}
        />
      </div>
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
      {showIOSInstallModal && <IOSInstallModal onClose={() => setShowIOSInstallModal(false)} />}
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
