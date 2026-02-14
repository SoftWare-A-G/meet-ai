import { Dialog } from '@base-ui/react/dialog'
import clsx from 'clsx'
import SidebarHeader from '../SidebarHeader'
import RoomList from '../RoomList'
import SidebarFooter from '../SidebarFooter'
import type { Room } from '../../lib/types'

type SidebarProps = {
  rooms: Room[]
  currentRoomId: string | null
  userName: string
  isOpen: boolean
  onSelectRoom: (room: Room) => void
  onNameChange: (name: string) => void
  onSettingsClick: () => void
  onClose: () => void
  onInstallClick: () => void
}

export default function Sidebar({ rooms, currentRoomId, userName, isOpen, onSelectRoom, onNameChange, onSettingsClick, onClose, onInstallClick }: SidebarProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <Dialog.Portal keepMounted>
        <Dialog.Backdrop className="fixed inset-0 z-[49] bg-black/50 [-webkit-tap-highlight-color:transparent] min-[701px]:hidden" />
        <Dialog.Popup
          render={<aside />}
          className={clsx(
            'w-[260px] flex flex-col shrink-0 border-r border-sidebar-border bg-sidebar-bg text-sidebar-text pb-[env(safe-area-inset-bottom,0px)]',
            'max-[700px]:fixed max-[700px]:top-0 max-[700px]:left-0 max-[700px]:z-50 max-[700px]:h-full',
            'max-[700px]:transition-transform max-[700px]:duration-[250ms] max-[700px]:ease-out',
            'max-[700px]:-translate-x-full max-[700px]:w-[280px] max-[700px]:max-w-[85vw]',
            isOpen && 'max-[700px]:translate-x-0'
          )}
        >
          <SidebarHeader onSettingsClick={onSettingsClick} onCloseClick={onClose} />
          <RoomList rooms={rooms} currentRoomId={currentRoomId} onSelectRoom={onSelectRoom} />
          <SidebarFooter userName={userName} onNameChange={onNameChange} onInstallClick={onInstallClick} />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
