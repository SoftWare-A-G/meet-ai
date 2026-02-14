import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'
import LobbyView from '../../components/LobbyView'
import MainHeader from '../../components/MainHeader'
import { useChatContext } from '../../lib/chat-context'
import type { Room } from '../../lib/types'

export const Route = createFileRoute('/chat/')({
  component: ChatLobby,
})

function ChatLobby() {
  const { rooms, setSidebarOpen } = useChatContext()
  const navigate = useNavigate()

  const handleSelectRoom = useCallback(
    (room: Room) => {
      navigate({ to: '/chat/$id', params: { id: room.id } })
    },
    [navigate]
  )

  return (
    <div className="bg-chat-bg text-msg-text flex h-dvh min-w-0 flex-1 flex-col">
      <MainHeader
        roomName="Select a channel"
        showInvite={false}
        showTeamToggle={false}
        onMobileToggle={() => setSidebarOpen(prev => !prev)}
        onTeamToggle={() => {}}
        onInviteClick={() => {}}
      />
      <LobbyView rooms={rooms} onSelectRoom={handleSelectRoom} />
    </div>
  )
}
