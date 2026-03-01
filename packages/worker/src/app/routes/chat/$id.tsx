import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect } from 'react'
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
  const { rooms, removeRoom, apiKey, userName, isStandalone, teamInfo, setSidebarOpen, setTeamSidebarOpen, setTeamInfo, setTasksInfo, showQR } = useChatContext()

  const room = rooms.find(r => r.id === id)
  const roomName = room?.name ?? 'Loading...'

  useEffect(() => {
    document.title = room ? `Meet AI: ${room.name}` : 'Meet AI'
    return () => { document.title = 'Meet AI' }
  }, [room])

  const handleDelete = useCallback(() => {
    if (!room) return
    toast(`Delete "${room.name}"?`, {
      description: 'This will remove all messages and cannot be undone.',
      actionButtonStyle: { backgroundColor: '#dc2626', color: '#fff' },
      action: {
        label: 'Delete',
        onClick: async () => {
          try {
            await deleteRoom(room.id)
            removeRoom(room.id)
            toast.success(`"${room.name}" deleted`)
            navigate({ to: '/chat' })
          } catch {
            toast.error('Failed to delete room. Please try again.')
          }
        },
      },
      cancel: {
        label: 'Cancel',
        onClick: () => {},
      },
      duration: 10000,
    })
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
        onDeleteClick={handleDelete}
      />
      {room && (
        <ChatView
          key={room.id}
          room={room}
          apiKey={apiKey}
          userName={userName}
          onTeamInfo={setTeamInfo}
          onTasksInfo={setTasksInfo}
        />
      )}
    </div>
  )
}
