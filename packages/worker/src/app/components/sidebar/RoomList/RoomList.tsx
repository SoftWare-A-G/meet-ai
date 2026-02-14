import type { Room } from '../../../lib/types'

type RoomListProps = {
  rooms: Room[]
  currentRoomId: string | null
  onSelectRoom: (room: Room) => void
}

export default function RoomList({ rooms, currentRoomId, onSelectRoom }: RoomListProps) {
  return (
    <>
      <div className="px-4 pt-2.5 pb-1 text-xs font-semibold uppercase tracking-wide opacity-60">Channels</div>
      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-1">
        {rooms.map(room => (
          <div
            key={room.id}
            className={`px-4 rounded cursor-pointer h-8 text-sm flex items-center gap-2 mb-px transition-colors duration-100 hover:bg-hover-item${room.id === currentRoomId ? ' bg-active text-active-text font-semibold' : ''}`}
            onClick={() => onSelectRoom(room)}
          >
            <span className="opacity-50 text-[13px]">#</span> {room.name}
          </div>
        ))}
      </div>
    </>
  )
}
