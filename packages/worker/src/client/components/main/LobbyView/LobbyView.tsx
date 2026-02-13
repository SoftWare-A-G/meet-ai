import EmptyState from '../EmptyState'
import type { Room } from '../../../lib/types'

type LobbyViewProps = {
  rooms: Room[]
  onSelectRoom: (room: Room) => void
}

export default function LobbyView({ rooms, onSelectRoom }: LobbyViewProps) {
  if (rooms.length === 0) {
    return <EmptyState message="No channels yet — create one to get started" />
  }

  return (
    <div class="lobby-view">
      <div class="lobby-heading">Select a channel</div>
      <div class="lobby-room-list">
        {rooms.map(room => (
          <div key={room.id} class="lobby-room-item" onClick={() => onSelectRoom(room)}>
            <span class="room-hash">#</span> {room.name}
          </div>
        ))}
      </div>
    </div>
  )
}
