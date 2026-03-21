import EmptyState from '../EmptyState'
import type { Room } from '../../lib/types'

type LobbyViewProps = {
  rooms: Room[]
  onSelectRoom: (room: Room) => void
}

export default function LobbyView({ rooms, onSelectRoom }: LobbyViewProps) {
  if (rooms.length === 0) {
    return <EmptyState message="No channels yet — create one to get started" />
  }

  return (
    <div className="flex-1 flex flex-col overflow-y-auto md:hidden">
      <div className="w-full flex flex-col">
        {rooms.map(room => (
          <div key={room.id} className="flex items-center justify-between px-4 py-3.5 cursor-pointer text-base transition-colors duration-150 border-b border-border hover:bg-hover-item" onClick={() => onSelectRoom(room)}>
            <span className="flex items-center gap-2 min-w-0">
              <span className="opacity-40 text-[15px]">#</span>
              <span className="truncate">{room.name}</span>
              {room.connected && (
                <span
                  aria-label="CLI connected"
                  title="CLI connected"
                  className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#22c55e] shadow-[0_0_0_3px_rgba(34,197,94,0.12)]"
                />
              )}
            </span>
            <span className="opacity-30 text-xl font-light">›</span>
          </div>
        ))}
      </div>
    </div>
  )
}
