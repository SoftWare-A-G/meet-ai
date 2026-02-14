import React, { useState, useCallback } from 'react'
import { Tooltip } from '@base-ui/react/tooltip'
import InstallButton from '../InstallButton'

type SidebarFooterProps = {
  userName: string
  onNameChange: (name: string) => void
  onInstallClick: () => void
}

const tooltipPopupClass = "rounded bg-gray-900 px-2 py-1 text-xs text-white shadow-lg"

export default function SidebarFooter({ userName, onNameChange, onInstallClick }: SidebarFooterProps) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(userName)

  const startEdit = useCallback(() => {
    setEditValue(userName)
    setEditing(true)
  }, [userName])

  const save = useCallback(() => {
    const val = editValue.trim()
    if (val) onNameChange(val)
    setEditing(false)
  }, [editValue, onNameChange])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); save() }
    if (e.key === 'Escape') { setEditValue(userName); setEditing(false) }
  }, [save, userName])

  return (
    <Tooltip.Provider delay={600} closeDelay={0}>
      <div className="px-4 py-2.5 border-t border-sidebar-border flex items-center gap-2 text-xs h-[52px]">
        <span className="w-2 h-2 rounded-full bg-presence shrink-0" />
        {editing ? (
          <input
            type="text"
            value={editValue}
            maxLength={30}
            className="bg-hover-item text-inherit border border-sidebar-border rounded px-1.5 py-0.5 text-[16px] w-[130px] outline-none font-semibold"
            onInput={(e) => setEditValue((e.target as HTMLInputElement).value)}
            onKeyDown={handleKeyDown}
            onBlur={save}
            ref={(el: HTMLInputElement | null) => el?.focus()}
          />
        ) : (
          <Tooltip.Root>
            <Tooltip.Trigger
              render={<span />}
              className="cursor-pointer font-semibold px-1.5 py-0.5 rounded transition-colors duration-100 flex-1 hover:bg-hover-item"
              onClick={startEdit}
            >
              {userName}
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner sideOffset={8}>
                <Tooltip.Popup className={tooltipPopupClass}>Click to change your name</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        )}
        <div className="flex items-center gap-1">
          <InstallButton onIOSInstall={onInstallClick} />
          <Tooltip.Root>
            <Tooltip.Trigger
              aria-label="API Key settings"
              className="bg-transparent border-none text-sidebar-text cursor-pointer text-[11px] p-1 rounded opacity-60 flex items-center justify-center hover:opacity-100 hover:bg-hover-item"
              onClick={() => { location.href = '/key' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" /></svg>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner sideOffset={8}>
                <Tooltip.Popup className={tooltipPopupClass}>API Key settings</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </div>
      </div>
    </Tooltip.Provider>
  )
}
