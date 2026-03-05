import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useChatContext } from '../../lib/chat-context'
import { deleteRoom } from '../../lib/api'
import MainHeader from '../../components/MainHeader'
import ChatView from '../../components/ChatView'

export const Route = createFileRoute('/chat/$id')({
  component: ChatRoom,
})

function ChatRoom() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const { rooms, removeRoom, apiKey, userName, isStandalone, teamInfo, setSidebarOpen, setTeamSidebarOpen, setTeamInfo, setTasksInfo, setCommandsInfo, showQR } = useChatContext()
  const [terminalOpen, setTerminalOpen] = useState(false)

  const room = rooms.find(r => r.id === id)
  const roomName = room?.name ?? 'Loading...'

  useEffect(() => {
    document.title = room ? `Meet AI: ${room.name}` : 'Meet AI'
    return () => { document.title = 'Meet AI' }
  }, [room])

  const handleDeleteConfirm = useCallback(async () => {
    if (!room) return
    try {
      await deleteRoom(room.id)
      removeRoom(room.id)
      toast.success(`"${room.name}" deleted`)
      navigate({ to: '/chat' })
    } catch {
      toast.error('Failed to delete room. Please try again.')
    }
  }, [room, removeRoom, navigate])

  return (
    <div className="flex-1 flex flex-col bg-chat-bg text-msg-text min-w-0 h-dvh">
      <MainHeader
        roomName={roomName}
        showInvite={!isStandalone && !!room}
        showTeamToggle={!!teamInfo}
        showDelete={!!room}
        onMobileToggle={() => setSidebarOpen(prev => !prev)}
        onTeamToggle={() => setTeamSidebarOpen(prev => !prev)}
        onInviteClick={() => showQR()}
        onDeleteConfirm={handleDeleteConfirm}
        onTerminalClick={() => setTerminalOpen(true)}
      />
      {room && (
        <ChatView
          key={room.id}
          room={room}
          apiKey={apiKey}
          userName={userName}
          onTeamInfo={setTeamInfo}
          onTasksInfo={setTasksInfo}
          onCommandsInfo={setCommandsInfo}
          terminalOpen={terminalOpen}
          onTerminalClose={() => setTerminalOpen(false)}
        />
      )}
    </div>
  )
}
