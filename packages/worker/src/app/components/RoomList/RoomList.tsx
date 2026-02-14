import clsx from 'clsx'
import { IconChevronRight } from '../../icons'
import type { Room } from '../../lib/types'

type RoomListProps = {
  rooms: Room[]
  currentRoomId: string | null
  onSelectRoom: (room: Room) => void
}

export default function RoomList({ rooms, currentRoomId, onSelectRoom }: RoomListProps) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      {rooms.map((room) => (
        <div
          key={room.id}
          className={clsx(
            'group flex items-center justify-between px-4 py-2.5 cursor-pointer text-sm transition-colors duration-100',
            'hover:bg-hover-item',
            room.id === currentRoomId
              ? 'bg-active text-active-text font-semibold'
              : 'text-sidebar-text'
          )}
          onClick={() => onSelectRoom(room)}
        >
          <span className="truncate">{room.name}</span>
          <IconChevronRight
            size={16}
            className={clsx(
              'shrink-0 ml-2 transition-opacity duration-100',
              room.id === currentRoomId ? 'opacity-50' : 'opacity-25 group-hover:opacity-40'
            )}
          />
        </div>
      ))}
    </div>
  )
}
