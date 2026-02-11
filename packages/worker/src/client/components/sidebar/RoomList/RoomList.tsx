import type { Room } from '../../../lib/types'

type RoomListProps = {
  rooms: Room[]
  currentRoomId: string | null
  onSelectRoom: (room: Room) => void
}

export default function RoomList({ rooms, currentRoomId, onSelectRoom }: RoomListProps) {
  return (
    <>
      <div class="sidebar-section-label">Channels</div>
      <div class="room-list">
        {rooms.map(room => (
          <div
            key={room.id}
            class={`room-item${room.id === currentRoomId ? ' active' : ''}`}
            onClick={() => onSelectRoom(room)}
          >
            <span class="room-hash">#</span> {room.name}
          </div>
        ))}
      </div>
    </>
  )
}
