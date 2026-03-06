import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarHeader as ShadcnSidebarHeader,
  SidebarFooter as ShadcnSidebarFooter,
} from '../ui/sidebar'
import SidebarHeaderContent from '../SidebarHeader'
import RoomList from '../RoomList'
import SidebarFooterContent from '../SidebarFooter'
import type { Room } from '../../lib/types'

type SidebarProps = {
  rooms: Room[]
  userName: string
  onNameChange: (name: string) => void
  onSettingsClick: () => void
  onSpawnClick: () => void
  onInstallClick: () => void
  onDeleteRoom?: (id: string) => void
}

export default function Sidebar({ rooms, userName, onNameChange, onSettingsClick, onSpawnClick, onInstallClick, onDeleteRoom }: SidebarProps) {
  return (
    <ShadcnSidebar className="pb-[env(safe-area-inset-bottom,0px)]">
      <ShadcnSidebarHeader className="h-14 shrink-0 flex-row items-center justify-between border-b border-sidebar-border px-4 py-0">
        <span className="text-base font-bold">Chats</span>
        <SidebarHeaderContent onSettingsClick={onSettingsClick} onSpawnClick={onSpawnClick} />
      </ShadcnSidebarHeader>
      <SidebarContent className="overflow-y-auto">
        <RoomList rooms={rooms} onDeleteRoom={onDeleteRoom} />
      </SidebarContent>
      <ShadcnSidebarFooter className="border-t border-sidebar-border p-0">
        <SidebarFooterContent userName={userName} onNameChange={onNameChange} onInstallClick={onInstallClick} />
      </ShadcnSidebarFooter>
    </ShadcnSidebar>
  )
}
