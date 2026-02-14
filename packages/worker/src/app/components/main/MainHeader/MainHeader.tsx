
type MainHeaderProps = {
  roomName: string
  showInvite: boolean
  showTeamToggle: boolean
  onMobileToggle: () => void
  onTeamToggle: () => void
  onInviteClick: () => void
}

export default function MainHeader({ roomName, showInvite, showTeamToggle, onMobileToggle, onTeamToggle, onInviteClick }: MainHeaderProps) {
  return (
    <div className="px-5 border-b border-border bg-header-bg text-header-text flex items-center justify-between shrink-0 h-14">
      <div className="flex items-center gap-2">
        <button className="flex items-center justify-center w-8 h-8 border-none bg-transparent text-header-text cursor-pointer text-xl min-[701px]:hidden" onClick={onMobileToggle}>&#9776;</button>
        <span className="opacity-50 text-[15px]">#</span>
        <span className="font-bold text-base">{roomName}</span>
      </div>
      <div className="flex items-center gap-3">
        {showInvite && (
          <button className="bg-transparent border border-white/30 text-header-text cursor-pointer flex! items-center justify-center px-2.5 py-1 rounded-md gap-1.5 text-xs font-semibold whitespace-nowrap hover:bg-white/10" title="Open on phone" onClick={onInviteClick}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></svg>
          </button>
        )}
        {showTeamToggle && (
          <button className="flex items-center justify-center w-8 h-8 border-none bg-transparent text-header-text cursor-pointer text-lg min-[769px]:hidden" title="Team members" onClick={onTeamToggle}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
          </button>
        )}
      </div>
    </div>
  )
}
