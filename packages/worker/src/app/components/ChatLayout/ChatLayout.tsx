import { useState, useCallback, useEffect } from 'react'
import { useLobbyWebSocket } from '../../hooks/useLobbyWebSocket'
import { useUrlRouting, getRoomIdFromUrl } from '../../hooks/useUrlRouting'
import * as api from '../../lib/api'
import MainPanel from '../main/MainPanel'
import IOSInstallModal from '../modals/IOSInstallModal'
import QRShareModal from '../modals/QRShareModal'
import SettingsModal from '../modals/SettingsModal'
import Toast from '../shared/Toast'
import Sidebar from '../sidebar/Sidebar'
import SidebarBackdrop from '../sidebar/SidebarBackdrop'
import TeamSidebar from '../team/TeamSidebar'
import type { Room, TeamInfo, TasksInfo } from '../../lib/types'

type ChatLayoutProps = {
  apiKey: string
  userName: string
  colorSchema: string
  onNameChange: (name: string) => void
  onSchemaChange: (schema: string) => void
}

export default function ChatLayout({
  apiKey,
  userName,
  colorSchema,
  onNameChange,
  onSchemaChange,
}: ChatLayoutProps) {
  const [rooms, setRooms] = useState<Room[]>([])
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [teamInfo, setTeamInfo] = useState<TeamInfo | null>(null)
  const [tasksInfo, setTasksInfo] = useState<TasksInfo | null>(null)
  const [teamSidebarOpen, setTeamSidebarOpen] = useState(false)
  const [showIOSInstall, setShowIOSInstall] = useState(false)

  const isStandalone =
    (window.navigator as any).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches

  // Load rooms on mount
  useEffect(() => {
    let cancelled = false
    async function load() {
      const loaded = await api.loadRooms()
      if (cancelled) return
      setRooms(loaded)

      // Select room from URL if present
      const roomId = getRoomIdFromUrl()
      if (roomId) {
        const room = loaded.find(r => r.id === roomId)
        if (room) setCurrentRoom(room)
      }
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

  // URL routing
  const { pushRoom } = useUrlRouting(
    rooms,
    useCallback(
      (roomId: string | null) => {
        if (roomId) {
          const room = rooms.find(r => r.id === roomId)
          setCurrentRoom(room ?? null)
        } else {
          setCurrentRoom(null)
        }
      },
      [rooms]
    )
  )

  const handleSelectRoom = useCallback(
    (room: Room) => {
      setCurrentRoom(room)
      setSidebarOpen(false)
      pushRoom(room.id)
    },
    [pushRoom]
  )

  const handleInstallClick = useCallback(() => {
    setSidebarOpen(false)
    setShowIOSInstall(true)
  }, [])

  const handleSettingsSave = useCallback(
    (schema: string) => {
      onSchemaChange(schema)
      setShowSettings(false)
    },
    [onSchemaChange]
  )

  // Ensure /chat is in history state
  useEffect(() => {
    if (!getRoomIdFromUrl()) {
      history.replaceState({ roomId: null }, '', location.pathname)
    }
  }, [])

  return (
    <>
      <Sidebar
        rooms={rooms}
        currentRoomId={currentRoom?.id ?? null}
        userName={userName}
        isOpen={sidebarOpen}
        onSelectRoom={handleSelectRoom}
        onNameChange={onNameChange}
        onSettingsClick={() => setShowSettings(true)}
        onClose={() => setSidebarOpen(false)}
        onInstallClick={handleInstallClick}
      />
      {sidebarOpen && <SidebarBackdrop onClick={() => setSidebarOpen(false)} />}
      <MainPanel
        currentRoom={currentRoom}
        rooms={rooms}
        apiKey={apiKey}
        userName={userName}
        showInvite={!isStandalone}
        showTeamToggle={!!teamInfo}
        onMobileToggle={() => setSidebarOpen(prev => !prev)}
        onTeamToggle={() => setTeamSidebarOpen(prev => !prev)}
        onInviteClick={() => setShowQR(true)}
        onSelectRoom={handleSelectRoom}
        onTeamInfo={setTeamInfo}
        onTasksInfo={setTasksInfo}
      />
      <TeamSidebar
        teamInfo={teamInfo}
        tasksInfo={tasksInfo}
        isOpen={teamSidebarOpen}
        onClose={() => setTeamSidebarOpen(false)}
      />
      <div
        className={`fixed inset-0 bg-black/50 z-[49] ${teamSidebarOpen ? 'block' : 'hidden'}`}
        onClick={() => setTeamSidebarOpen(false)}
      />
      {showSettings && (
        <SettingsModal
          currentSchema={colorSchema}
          onSave={handleSettingsSave}
          onClose={() => setShowSettings(false)}
        />
      )}
      {showQR && (
        <QRShareModal
          onClose={() => setShowQR(false)}
          onToast={text => {
            setToast(text)
            setShowQR(false)
          }}
        />
      )}
      {showIOSInstall && <IOSInstallModal onClose={() => setShowIOSInstall(false)} />}
      {toast && <Toast text={toast} onDone={() => setToast(null)} />}
    </>
  )
}
