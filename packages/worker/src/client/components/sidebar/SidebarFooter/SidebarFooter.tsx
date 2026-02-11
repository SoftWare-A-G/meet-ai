import { useState, useCallback } from 'hono/jsx/dom'
import InstallButton from '../../chat/InstallButton'

type SidebarFooterProps = {
  userName: string
  onNameChange: (name: string) => void
}

export default function SidebarFooter({ userName, onNameChange }: SidebarFooterProps) {
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

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); save() }
    if (e.key === 'Escape') { setEditValue(userName); setEditing(false) }
  }, [save, userName])

  return (
    <div class="sidebar-footer">
      <span class="user-presence" style="width:8px;height:8px;border-radius:50%;background:var(--c-presence);flex-shrink:0;" />
      {editing ? (
        <input
          type="text"
          value={editValue}
          maxLength={30}
          style="background:var(--c-hover-item);color:inherit;border:1px solid var(--c-sidebar-border);border-radius:4px;padding:2px 6px;font-size:16px;width:130px;outline:none;font-weight:600;"
          onInput={(e) => setEditValue((e.target as HTMLInputElement).value)}
          onKeyDown={handleKeyDown}
          onBlur={save}
          ref={(el: HTMLInputElement | null) => el?.focus()}
        />
      ) : (
        <span class="user-handle" title="Click to change your name" onClick={startEdit}>
          {userName}
        </span>
      )}
      <div class="sidebar-footer-actions">
        <InstallButton />
        <button title="API Key settings" onClick={() => { location.href = '/key' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" /></svg>
        </button>
      </div>
    </div>
  )
}
