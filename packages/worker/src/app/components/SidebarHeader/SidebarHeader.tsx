
type SidebarHeaderProps = {
  onSettingsClick: () => void
  onCloseClick: () => void
}

export default function SidebarHeader({ onSettingsClick, onCloseClick }: SidebarHeaderProps) {
  return (
    <div className="px-4 font-bold text-base border-b border-sidebar-border flex items-center justify-between h-14 shrink-0">
      <span>meet-ai</span>
      <div className="flex items-center gap-1">
        <button type="button" className="bg-transparent border-none text-sidebar-text cursor-pointer opacity-70 p-1.5 rounded flex items-center justify-center w-8 h-8 hover:opacity-100 hover:bg-hover-item" title="Color Settings" onClick={onSettingsClick}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
        </button>
        <button type="button" className="hidden items-center justify-center hover:opacity-100 hover:bg-hover-item bg-transparent border-none text-sidebar-text cursor-pointer opacity-70 p-1.5 rounded w-8 h-8 max-[700px]:flex max-[700px]:items-center max-[700px]:justify-center" title="Close sidebar" onClick={onCloseClick}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
        </button>
      </div>
    </div>
  )
}
