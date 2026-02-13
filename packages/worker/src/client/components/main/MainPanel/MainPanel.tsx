import MainHeader from '../MainHeader'
import LobbyView from '../LobbyView'
import ChatView from '../../chat/ChatView'
import type { Room, TeamInfo } from '../../../lib/types'

type MainPanelProps = {
  currentRoom: Room | null
  rooms: Room[]
  apiKey: string
  userName: string
  showInvite: boolean
  showTeamToggle: boolean
  onMobileToggle: () => void
  onTeamToggle: () => void
  onInviteClick: () => void
  onSelectRoom: (room: Room) => void
  onTeamInfo?: (info: TeamInfo | null) => void
}

export default function MainPanel({ currentRoom, rooms, apiKey, userName, showInvite, showTeamToggle, onMobileToggle, onTeamToggle, onInviteClick, onSelectRoom, onTeamInfo }: MainPanelProps) {
  const roomName = currentRoom?.name ?? 'Select a channel'

  return (
    <div class="main">
      <MainHeader
        roomName={roomName}
        showInvite={showInvite && !!currentRoom}
        showTeamToggle={showTeamToggle}
        onMobileToggle={onMobileToggle}
        onTeamToggle={onTeamToggle}
        onInviteClick={onInviteClick}
      />
      {currentRoom ? (
        <ChatView key={currentRoom.id} room={currentRoom} apiKey={apiKey} userName={userName} onTeamInfo={onTeamInfo} />
      ) : (
        <LobbyView rooms={rooms} onSelectRoom={onSelectRoom} />
      )}
    </div>
  )
}
