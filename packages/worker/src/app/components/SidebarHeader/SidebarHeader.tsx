import { Tooltip } from '@base-ui/react/tooltip'
import { IconSettings, IconX } from '../../icons'

type SidebarHeaderProps = {
  onSettingsClick: () => void
  onCloseClick: () => void
}

const tooltipPopupClass = "rounded bg-gray-900 px-2 py-1 text-xs text-white shadow-lg"

export default function SidebarHeader({ onSettingsClick, onCloseClick }: SidebarHeaderProps) {
  return (
    <div className="px-4 font-bold text-base border-b border-sidebar-border flex items-center justify-between h-14 shrink-0">
      <span>meet-ai</span>
      <Tooltip.Provider delay={600} closeDelay={0}>
        <div className="flex items-center gap-1">
          <Tooltip.Root>
            <Tooltip.Trigger
              aria-label="Color Settings"
              className="bg-transparent border-none text-sidebar-text cursor-pointer opacity-70 p-1.5 rounded flex items-center justify-center w-8 h-8 hover:opacity-100 hover:bg-hover-item"
              onClick={onSettingsClick}
            >
              <IconSettings size={18} />
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner sideOffset={8}>
                <Tooltip.Popup className={tooltipPopupClass}>Color Settings</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
          <Tooltip.Root>
            <Tooltip.Trigger
              aria-label="Close sidebar"
              className="hidden items-center justify-center hover:opacity-100 hover:bg-hover-item bg-transparent border-none text-sidebar-text cursor-pointer opacity-70 p-1.5 rounded w-8 h-8 max-[700px]:flex max-[700px]:items-center max-[700px]:justify-center"
              onClick={onCloseClick}
            >
              <IconX size={18} />
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner sideOffset={8}>
                <Tooltip.Popup className={tooltipPopupClass}>Close sidebar</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </div>
      </Tooltip.Provider>
    </div>
  )
}
