
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
    <div class="main-header">
      <div class="main-header-left">
        <button class="mobile-toggle" onClick={onMobileToggle}>&#9776;</button>
        <span class="channel-hash">#</span>
        <span class="channel-name">{roomName}</span>
      </div>
      <div class="main-header-right">
        {showInvite && (
          <button class="invite-btn" title="Open on phone" onClick={onInviteClick}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></svg>
          </button>
        )}
        {showTeamToggle && (
          <button class="team-toggle" title="Team members" onClick={onTeamToggle}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
          </button>
        )}
      </div>
    </div>
  )
}
