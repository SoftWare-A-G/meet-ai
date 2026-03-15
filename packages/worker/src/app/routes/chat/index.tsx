import { createFileRoute } from '@tanstack/react-router'
import { useCallback } from 'react'
import LobbyView from '../../components/LobbyView'
import MainHeader from '../../components/MainHeader'
import { useRoomsQuery } from '../../hooks/useRoomsQuery'
import type { Room } from '../../lib/types'

export const Route = createFileRoute('/chat/')({
  component: ChatLobby,
})

function ChatLobby() {
  const { data: rooms = [] } = useRoomsQuery()
  const navigate = Route.useNavigate()

  const handleSelectRoom = useCallback(
    (room: Room) => {
      navigate({ to: '/chat/$id', params: { id: room.id } })
    },
    [navigate]
  )

  return (
    <div className="bg-chat-bg text-msg-text flex h-dvh min-w-0 flex-1 flex-col">
      <MainHeader
        room={undefined}
        projects={[]}
        roomName="Select a channel"
        showInvite={false}
        showTeamToggle={false}
        onTeamToggle={() => {}}
        onInviteClick={() => {}}
        onRename={() => {}}
        onAttachProject={() => {}}
        onDelete={() => {}}
      />
      <LobbyView rooms={rooms} onSelectRoom={handleSelectRoom} />
    </div>
  )
}
