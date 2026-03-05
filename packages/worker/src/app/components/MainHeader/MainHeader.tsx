import { Tooltip } from '@base-ui/react/tooltip'
import { IconMenu2, IconQrcode, IconTerminal, IconTrash, IconUsers } from '../../icons'
import DeleteConfirmPopover from '../DeleteConfirmPopover'

type MainHeaderProps = {
  roomName: string
  showInvite: boolean
  showTeamToggle: boolean
  showDelete: boolean
  onMobileToggle: () => void
  onTeamToggle: () => void
  onInviteClick: () => void
  onDeleteConfirm: () => void
  onTerminalClick?: () => void
}

const tooltipPopupClass = "rounded bg-gray-900 px-2 py-1 text-xs text-white shadow-lg"

export default function MainHeader({
  roomName,
  showInvite,
  showTeamToggle,
  showDelete,
  onMobileToggle,
  onTeamToggle,
  onInviteClick,
  onDeleteConfirm,
  onTerminalClick,
}: MainHeaderProps) {
  return (
    <Tooltip.Provider delay={600} closeDelay={0}>
      <div className="border-border bg-header-bg text-header-text flex h-14 shrink-0 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="text-header-text flex h-8 w-8 cursor-pointer items-center justify-center border-none bg-transparent text-xl min-[701px]:hidden"
            onClick={onMobileToggle}>
            <IconMenu2 size={20} />
          </button>
          {showDelete && (
            <DeleteConfirmPopover roomName={roomName} onConfirm={onDeleteConfirm}>
              <button
                type="button"
                aria-label="Delete room"
                className="text-header-text flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-lg hover:bg-white/10 hover:text-red-400"
              >
                <IconTrash size={18} />
              </button>
            </DeleteConfirmPopover>
          )}
          <span className="text-base font-bold">{roomName}</span>
        </div>
        <div className="flex items-center gap-3">
          <Tooltip.Root>
            <Tooltip.Trigger
              aria-label="Terminal viewer"
              className="text-header-text flex h-8 w-8 cursor-pointer items-center justify-center border-none bg-transparent text-lg hover:bg-white/10 rounded-md"
              onClick={onTerminalClick}
            >
              <IconTerminal size={18} />
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner sideOffset={8}>
                <Tooltip.Popup className={tooltipPopupClass}>Terminal viewer</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
          {showInvite && (
            <Tooltip.Root>
              <Tooltip.Trigger
                aria-label="QR code"
                className="text-header-text flex! cursor-pointer items-center justify-center gap-1.5 rounded-md border border-white/30 bg-transparent px-2.5 py-1 text-xs font-semibold whitespace-nowrap hover:bg-white/10"
                onClick={onInviteClick}
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
