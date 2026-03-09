import { Tooltip } from '@base-ui/react/tooltip'
import { IconQrcode, IconTerminal, IconUsers } from '../../icons'
import RoomSettings from '../RoomSettings'
import { useHaptics } from '../../hooks/useHaptics'
import { SidebarTrigger } from '../ui/sidebar'
import type { Project, Room } from '../../lib/types'

type MainHeaderProps = {
  room: Room | undefined
  projects: Project[]
  roomName: string
  showInvite: boolean
  showTeamToggle: boolean
  onTeamToggle: () => void
  onInviteClick: () => void
  onRename: (name: string) => void
  onAttachProject: (projectId: string | null) => void
  onDelete: () => void
  onTerminalClick?: () => void
}

const tooltipPopupClass = "rounded bg-gray-900 px-2 py-1 text-xs text-white shadow-lg"

export default function MainHeader({
  room,
  projects,
  roomName,
  showInvite,
  showTeamToggle,
  onTeamToggle,
  onInviteClick,
  onRename,
  onAttachProject,
  onDelete,
  onTerminalClick,
}: MainHeaderProps) {
  const { trigger } = useHaptics()
  return (
    <Tooltip.Provider delay={600} closeDelay={0}>
      <div className="border-border bg-header-bg text-header-text flex h-14 shrink-0 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="text-header-text md:hidden" />
          {room && (
            <RoomSettings
              room={room}
              projects={projects}
              onRename={onRename}
              onAttachProject={onAttachProject}
              onDelete={onDelete}
            />
          )}
          <span className="text-base font-bold">{roomName}</span>
        </div>
        <div className="flex items-center gap-3">
          {onTerminalClick && (
            <Tooltip.Root>
              <Tooltip.Trigger
                aria-label="Terminal viewer"
                className="text-header-text flex h-8 w-8 cursor-pointer items-center justify-center border-none bg-transparent text-lg hover:bg-white/10 rounded-md"
                onClick={() => { trigger('light'); onTerminalClick?.() }}
              >
                <IconTerminal size={18} />
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Positioner sideOffset={8}>
                  <Tooltip.Popup className={tooltipPopupClass}>Terminal viewer</Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
          )}
          {showInvite && (
            <Tooltip.Root>
              <Tooltip.Trigger
                aria-label="QR code"
                className="text-header-text flex! cursor-pointer items-center justify-center gap-1.5 rounded-md border border-white/30 bg-transparent px-2.5 py-1 text-xs font-semibold whitespace-nowrap hover:bg-white/10"
                onClick={() => { trigger('light'); onInviteClick() }}
              >
                <IconQrcode size={18} />
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Positioner sideOffset={8}>
                  <Tooltip.Popup className={tooltipPopupClass}>QR code</Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
          )}
          {showTeamToggle && (
            <Tooltip.Root>
              <Tooltip.Trigger
                aria-label="Team members"
                className="text-header-text flex h-8 w-8 cursor-pointer items-center justify-center border-none bg-transparent text-lg min-[769px]:hidden"
                onClick={onTeamToggle}
              >
                <IconUsers size={18} />
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Positioner sideOffset={8}>
                  <Tooltip.Popup className={tooltipPopupClass}>Team members</Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
          )}
        </div>
      </div>
    </Tooltip.Provider>
  )
}
