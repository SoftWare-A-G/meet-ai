import { useCallback } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { IconChevronRight, IconTrash } from '../../icons'
import DeleteConfirmPopover from '../DeleteConfirmPopover'
import { useHaptics } from '../../hooks/useHaptics'
import {
  useSidebar,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '../ui/sidebar'
import type { Room } from '../../lib/types'

type RoomListProps = {
  rooms: Room[]
  onDeleteRoom?: (id: string) => void
}

export default function RoomList({ rooms, onDeleteRoom }: RoomListProps) {
  const { trigger } = useHaptics()
  const { isMobile, setOpenMobile } = useSidebar()
  const params = useParams({ strict: false }) as { id?: string }
  const handleLinkClick = useCallback(() => {
    trigger('light')
    if (isMobile) setOpenMobile(false)
  }, [trigger, isMobile, setOpenMobile])
  return (
    <SidebarGroup className="p-0">
      <SidebarGroupContent>
        <SidebarMenu>
          {rooms.map((room) => {
            const isActive = params.id === room.id
            return (
              <SidebarMenuItem key={room.id} className="group/room">
                <SidebarMenuButton
                  render={<Link to="/chat/$id" params={{ id: room.id }} />}
                  isActive={isActive}
                  onClick={handleLinkClick}
                  className="rounded-none px-4 py-2.5 h-auto data-active:bg-active data-active:text-active-text data-active:font-semibold"
                >
                  <span className="truncate">{room.name}</span>
                  <span className="shrink-0 ml-auto flex items-center gap-1">
                    <IconChevronRight
                      size={16}
                      className={`transition-opacity duration-100 ${isActive ? 'opacity-50' : 'opacity-25 group-hover/room:opacity-40'}`}
                    />
                  </span>
                </SidebarMenuButton>
                {onDeleteRoom && (
                  <DeleteConfirmPopover roomName={room.name} onConfirm={() => onDeleteRoom(room.id)}>
                    <button
                      type="button"
                      aria-label={`Delete ${room.name}`}
                      className="absolute right-8 top-1/2 -translate-y-1/2 flex h-6 w-6 cursor-pointer items-center justify-center rounded border-none bg-transparent text-gray-500 opacity-0 transition-opacity duration-100 group-hover/room:opacity-100 group-has-data-popup-open/room:opacity-100 hover:text-red-400 data-[popup-open]:text-red-400"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
                    >
                      <IconTrash size={14} />
                    </button>
                  </DeleteConfirmPopover>
                )}
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
