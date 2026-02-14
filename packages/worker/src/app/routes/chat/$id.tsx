import { createFileRoute } from '@tanstack/react-router'
import { useChatContext } from '../../lib/chat-context'
import MainHeader from '../../components/MainHeader'
import ChatView from '../../components/ChatView'

export const Route = createFileRoute('/chat/$id')({
  component: ChatRoom,
})

function ChatRoom() {
  const { id } = Route.useParams()
  const { rooms, apiKey, userName, isStandalone, teamInfo, setSidebarOpen, setTeamSidebarOpen, setTeamInfo, setTasksInfo, showQR } = useChatContext()

  const room = rooms.find(r => r.id === id)
  const roomName = room?.name ?? 'Loading...'

  return (
    <div className="flex-1 flex flex-col bg-chat-bg text-msg-text min-w-0 h-dvh">
      <MainHeader
        roomName={roomName}
        showInvite={!isStandalone && !!room}
        showTeamToggle={!!teamInfo}
        onMobileToggle={() => setSidebarOpen(prev => !prev)}
        onTeamToggle={() => setTeamSidebarOpen(prev => !prev)}
        onInviteClick={() => showQR()}
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
