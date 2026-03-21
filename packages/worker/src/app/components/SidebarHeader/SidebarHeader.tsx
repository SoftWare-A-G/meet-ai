import { useHaptics } from '../../hooks/useHaptics'
import { IconSettings, IconPlus } from '../../icons'
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '../ui/sidebar'

type SidebarHeaderProps = {
  onSettingsClick: () => void
  onSpawnClick: () => void
}

export default function SidebarHeader({ onSettingsClick, onSpawnClick }: SidebarHeaderProps) {
  const { trigger } = useHaptics()
  return (
    <SidebarMenu className="w-auto flex-row gap-1">
      <SidebarMenuItem>
        <SidebarMenuButton
          size="sm"
          tooltip={{ children: 'Spawn Team', hidden: false }}
          className="h-8 w-8 justify-center rounded p-1.5 opacity-70 hover:opacity-100"
          onClick={() => {
            trigger('light')
            onSpawnClick()
          }}>
          <IconPlus size={18} />
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton
          size="sm"
          tooltip={{ children: 'Color Settings', hidden: false }}
          className="h-8 w-8 justify-center rounded p-1.5 opacity-70 hover:opacity-100"
          onClick={() => {
            trigger('light')
            onSettingsClick()
          }}>
          <IconSettings size={18} />
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
