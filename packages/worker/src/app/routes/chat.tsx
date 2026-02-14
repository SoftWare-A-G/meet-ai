import { ClientOnly, createFileRoute, Outlet, useNavigate } from '@tanstack/react-router'
import { useState, useCallback, useEffect, useMemo } from 'react'
import IOSInstallModal from '../components/IOSInstallModal'
import LoginPrompt from '../components/LoginPrompt'
import QRShareModal from '../components/QRShareModal'
import SettingsModal from '../components/SettingsModal'
import Sidebar from '../components/Sidebar'
import SidebarBackdrop from '../components/SidebarBackdrop'
import TeamSidebar from '../components/TeamSidebar'
import Toast from '../components/Toast'
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
  const navigate = useNavigate()
  const [rooms, setRooms] = useState<Room[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showQRModal, setShowQRModal] = useState(false)
  const [showIOSInstallModal, setShowIOSInstallModal] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
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
    setRooms(prev => [...prev, { id, name }])
  }, [])
  useLobbyWebSocket(apiKey, onRoomCreated)

  const handleSelectRoom = useCallback(
    (room: Room) => {
      setSidebarOpen(false)
      navigate({ to: '/chat/$id', params: { id: room.id } })
    },
    [navigate]
  )

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

  // Find current room ID from URL for sidebar highlight
  const currentRoomId = location.pathname.match(/^\/chat\/([a-f0-9-]+)$/i)?.[1] ?? null

  return (
    <ChatContext.Provider value={ctx}>
      <div className="flex h-dvh">
        <Sidebar
          rooms={rooms}
          currentRoomId={currentRoomId}
          userName={userName}
          isOpen={sidebarOpen}
          onSelectRoom={handleSelectRoom}
          onNameChange={onNameChange}
          onSettingsClick={() => setShowSettingsModal(true)}
          onClose={() => setSidebarOpen(false)}
          onInstallClick={handleInstallClick}
        />
        {sidebarOpen && <SidebarBackdrop onClick={() => setSidebarOpen(false)} />}
        <Outlet />
        <TeamSidebar
          teamInfo={teamInfo}
          tasksInfo={tasksInfo}
          isOpen={teamSidebarOpen}
          onClose={() => setTeamSidebarOpen(false)}
        />
      </div>
      <div
        className={`fixed inset-0 z-49 bg-black/50 ${teamSidebarOpen ? 'block' : 'hidden'}`}
        onClick={() => setTeamSidebarOpen(false)}
      />
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
            setToast(text)
            setShowQRModal(false)
          }}
        />
      )}
      {showIOSInstallModal && <IOSInstallModal onClose={() => setShowIOSInstallModal(false)} />}
      {toast && <Toast text={toast} onDone={() => setToast(null)} />}
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
