import { Link } from '@tanstack/react-router'
import { IconChevronRight } from '../../icons'
import type { Room } from '../../lib/types'

type RoomListProps = {
  rooms: Room[]
  onLinkClick?: () => void
}

export default function RoomList({ rooms, onLinkClick }: RoomListProps) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      {rooms.map((room) => (
        <Link
          key={room.id}
          to="/chat/$id"
          params={{ id: room.id }}
          className="group flex items-center justify-between px-4 py-2.5 cursor-pointer text-sm transition-colors duration-100 hover:bg-hover-item"
          activeProps={{ className: 'bg-active text-active-text font-semibold' }}
          inactiveProps={{ className: 'text-sidebar-text' }}
          onClick={onLinkClick}
        >
          {({ isActive }) => (
            <>
              <span className="truncate">{room.name}</span>
              <IconChevronRight
                size={16}
                className={`shrink-0 ml-2 transition-opacity duration-100 ${isActive ? 'opacity-50' : 'opacity-25 group-hover:opacity-40'}`}
              />
            </>
          )}
        </Link>
      ))}
    </div>
  )
}
