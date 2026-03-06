import { Tooltip } from '@base-ui/react/tooltip'
import { IconSettings, IconPlus } from '../../icons'
import { useHaptics } from '../../hooks/useHaptics'
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '../ui/sidebar'

type SidebarHeaderProps = {
  onSettingsClick: () => void
  onSpawnClick: () => void
}

const tooltipPopupClass = "rounded bg-gray-900 px-2 py-1 text-xs text-white shadow-lg"

export default function SidebarHeader({ onSettingsClick, onSpawnClick }: SidebarHeaderProps) {
  const { trigger } = useHaptics()
  return (
    <SidebarMenu className="w-auto flex-row gap-0">
      <SidebarMenuItem>
        <Tooltip.Provider delay={600} closeDelay={0}>
          <Tooltip.Root>
            <Tooltip.Trigger render={
              <SidebarMenuButton
                size="sm"
                className="h-8 w-8 p-1.5 justify-center opacity-70 hover:opacity-100"
                onClick={() => { trigger('light'); onSpawnClick() }}
              />
            }>
              <IconPlus size={18} />
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner sideOffset={8}>
                <Tooltip.Popup className={tooltipPopupClass}>Spawn Team</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <Tooltip.Provider delay={600} closeDelay={0}>
          <Tooltip.Root>
            <Tooltip.Trigger render={
              <SidebarMenuButton
                size="sm"
                className="h-8 w-8 p-1.5 justify-center opacity-70 hover:opacity-100"
                onClick={() => { trigger('light'); onSettingsClick() }}
              />
            }>
              <IconSettings size={18} />
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner sideOffset={8}>
                <Tooltip.Popup className={tooltipPopupClass}>Color Settings</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
