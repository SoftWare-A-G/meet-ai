import { formatTime } from '../../lib/dates'

type SpawnRequestCardProps = {
  roomName: string
  sender: string
  timestamp?: string
}

export default function SpawnRequestCard({ roomName, sender, timestamp }: SpawnRequestCardProps) {
  return (
    <div className="mx-auto my-2 flex w-full max-w-[600px] items-center gap-3 rounded-lg border border-[#30363d] bg-[#161b22] px-4 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#238636]/20 text-[#3fb950]">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M7.5 1a6.5 6.5 0 100 13 6.5 6.5 0 000-13zm0 12a5.5 5.5 0 110-11 5.5 5.5 0 010 11zm.5-8.5v3h3v1h-3v3h-1v-3h-3v-1h3v-3h1z" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] text-[#8b949e]">
          <span className="font-medium text-[#c9d1d9]">{sender}</span> requested to spawn team
        </div>
        <div className="text-sm font-semibold text-[#c9d1d9]">{roomName}</div>
      </div>
      {timestamp && (
        <div className="shrink-0 text-[11px] text-[#484f58]">{formatTime(timestamp)}</div>
      )}
    </div>
  )
}
