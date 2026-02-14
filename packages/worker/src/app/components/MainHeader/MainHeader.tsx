type MainHeaderProps = {
  roomName: string
  showInvite: boolean
  showTeamToggle: boolean
  onMobileToggle: () => void
  onTeamToggle: () => void
  onInviteClick: () => void
}

export default function MainHeader({
  roomName,
  showInvite,
  showTeamToggle,
  onMobileToggle,
  onTeamToggle,
  onInviteClick,
}: MainHeaderProps) {
  return (
    <div className="border-border bg-header-bg text-header-text flex h-14 shrink-0 items-center justify-between border-b px-5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="text-header-text flex h-8 w-8 cursor-pointer items-center justify-center border-none bg-transparent text-xl min-[701px]:hidden"
          onClick={onMobileToggle}>
          &#9776;
        </button>
        <span className="text-[15px] opacity-50">#</span>
        <span className="text-base font-bold">{roomName}</span>
      </div>
      <div className="flex items-center gap-3">
        {showInvite && (
          <button
            type="button"
            className="text-header-text flex! cursor-pointer items-center justify-center gap-1.5 rounded-md border border-white/30 bg-transparent px-2.5 py-1 text-xs font-semibold whitespace-nowrap hover:bg-white/10"
            title="Open on phone"
            onClick={onInviteClick}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round">
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
              <line x1="12" y1="18" x2="12.01" y2="18" />
            </svg>
          </button>
        )}
        {showTeamToggle && (
          <button
            type="button"
            className="text-header-text flex h-8 w-8 cursor-pointer items-center justify-center border-none bg-transparent text-lg min-[769px]:hidden"
            title="Team members"
            onClick={onTeamToggle}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
