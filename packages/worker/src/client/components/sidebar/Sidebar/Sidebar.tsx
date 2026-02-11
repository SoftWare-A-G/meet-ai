import SidebarHeader from '../SidebarHeader'
import RoomList from '../RoomList'
import SidebarFooter from '../SidebarFooter'
import type { Room } from '../../../lib/types'

type SidebarProps = {
  rooms: Room[]
  currentRoomId: string | null
  userName: string
  isOpen: boolean
  onSelectRoom: (room: Room) => void
  onNameChange: (name: string) => void
  onSettingsClick: () => void
  onClose: () => void
}

export default function Sidebar({ rooms, currentRoomId, userName, isOpen, onSelectRoom, onNameChange, onSettingsClick, onClose }: SidebarProps) {
  return (
    <aside class={`sidebar${isOpen ? ' open' : ''}`}>
      <SidebarHeader onSettingsClick={onSettingsClick} onCloseClick={onClose} />
      <RoomList rooms={rooms} currentRoomId={currentRoomId} onSelectRoom={onSelectRoom} />
      <SidebarFooter userName={userName} onNameChange={onNameChange} />
    </aside>
  )
}
