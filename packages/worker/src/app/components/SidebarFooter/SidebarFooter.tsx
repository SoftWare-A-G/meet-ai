import { Tooltip } from '@base-ui/react/tooltip'
import React, { useState, useCallback } from 'react'
import { IconKey } from '../../icons'
import InstallButton from '../InstallButton'
import { useSidebar, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '../ui/sidebar'

type SidebarFooterProps = {
  userName: string
  onNameChange: (name: string) => void
  onInstallClick: () => void
}

const tooltipPopupClass = 'rounded bg-gray-900 px-2 py-1 text-xs text-white shadow-lg'

export default function SidebarFooter({
  userName,
  onNameChange,
  onInstallClick,
}: SidebarFooterProps) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(userName)
  const { isMobile, setOpenMobile } = useSidebar()

  const startEdit = useCallback(() => {
    setEditValue(userName)
    setEditing(true)
  }, [userName])

  const save = useCallback(() => {
    const val = editValue.trim()
    if (val) onNameChange(val)
    setEditing(false)
  }, [editValue, onNameChange])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        save()
      }
      if (e.key === 'Escape') {
        setEditValue(userName)
        setEditing(false)
      }
    },
    [save, userName]
  )

  const handleInstallClick = useCallback(() => {
    if (isMobile) setOpenMobile(false)
    onInstallClick()
  }, [isMobile, setOpenMobile, onInstallClick])

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size="lg"
          className="h-[52px] cursor-default px-4 py-2.5 hover:bg-transparent active:bg-transparent">
          {editing ? (
            <input
              type="text"
              value={editValue}
              maxLength={30}
              className="bg-sidebar-accent border-sidebar-border w-[130px] rounded border px-1.5 py-0.5 text-[16px] font-semibold text-inherit outline-none"
              onInput={e => setEditValue((e.target as HTMLInputElement).value)}
              onKeyDown={handleKeyDown}
              onBlur={save}
              ref={(el: HTMLInputElement | null) => el?.focus()}
            />
          ) : (
            <Tooltip.Provider delay={600} closeDelay={0}>
              <Tooltip.Root>
                <Tooltip.Trigger
                  render={<span />}
                  className="hover:bg-sidebar-accent flex-1 cursor-pointer rounded px-1.5 py-0.5 text-xs font-semibold transition-colors duration-100"
                  onClick={startEdit}>
                  {userName}
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Positioner sideOffset={8}>
                    <Tooltip.Popup className={tooltipPopupClass}>
                      Click to change your name
                    </Tooltip.Popup>
                  </Tooltip.Positioner>
                </Tooltip.Portal>
              </Tooltip.Root>
            </Tooltip.Provider>
          )}
          <div className="ml-auto flex items-center gap-1">
            <InstallButton onIOSInstall={handleInstallClick} />
            <Tooltip.Provider delay={600} closeDelay={0}>
              <Tooltip.Root>
                <Tooltip.Trigger
                  aria-label="API Key settings"
                  className="text-sidebar-foreground hover:bg-sidebar-accent flex cursor-pointer items-center justify-center rounded border-none bg-transparent p-1 text-[11px] opacity-60 hover:opacity-100"
                  onClick={() => {
                    location.href = '/key'
                  }}>
                  <IconKey size={16} />
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Positioner sideOffset={8}>
                    <Tooltip.Popup className={tooltipPopupClass}>API Key settings</Tooltip.Popup>
                  </Tooltip.Positioner>
                </Tooltip.Portal>
              </Tooltip.Root>
            </Tooltip.Provider>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
