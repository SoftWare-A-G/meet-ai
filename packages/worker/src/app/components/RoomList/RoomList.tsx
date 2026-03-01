import { Link } from '@tanstack/react-router'
import { IconChevronRight, IconTrash } from '../../icons'
import DeleteConfirmPopover from '../DeleteConfirmPopover'
import type { Room } from '../../lib/types'

type RoomListProps = {
  rooms: Room[]
  onLinkClick?: () => void
  onDeleteRoom?: (id: string) => void
}

export default function RoomList({ rooms, onLinkClick, onDeleteRoom }: RoomListProps) {
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
              <span className="shrink-0 ml-2 flex items-center">
                <IconChevronRight
                  size={16}
                  className={`transition-opacity duration-100 group-hover:hidden ${isActive ? 'opacity-50' : 'opacity-25'}`}
                />
                {onDeleteRoom && (
                  <DeleteConfirmPopover roomName={room.name} onConfirm={() => onDeleteRoom(room.id)}>
                    <button
                      type="button"
                      aria-label={`Delete ${room.name}`}
                      className="hidden group-hover:flex h-6 w-6 cursor-pointer items-center justify-center rounded border-none bg-transparent text-gray-400 hover:text-red-400"
                      onClick={(e) => e.preventDefault()}
                    >
                      <IconTrash size={14} />
                    </button>
                  </DeleteConfirmPopover>
                )}
              </span>
            </>
          )}
        </Link>
      ))}
    </div>
  )
}
