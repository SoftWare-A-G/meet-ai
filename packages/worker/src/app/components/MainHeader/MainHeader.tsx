import { useHaptics } from '@meet-ai/worker/app/hooks/useHaptics'
import { IconCanvas, IconQrcode, IconTerminal, IconUsers } from '@meet-ai/worker/app/icons'
import { useChatShellStore } from '@meet-ai/worker/app/stores/useChatShellStore'
import RoomSettings from '../RoomSettings'
import { SidebarTrigger } from '../ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import type { RoomsResponse, ProjectsResponse } from '@meet-ai/worker/app/lib/fetchers'

type MainHeaderProps = {
  room: RoomsResponse[number] | undefined
  projects: ProjectsResponse
  roomName: string
  showInvite: boolean
  showTeamToggle: boolean
  onTerminalClick: () => void
  onCanvasClick: () => void
}

export default function MainHeader({
  room,
  projects = [],
  roomName = 'Select a channel',
  showInvite = false,
  showTeamToggle = false,
  onTerminalClick,
  onCanvasClick,
}: MainHeaderProps) {
  const { trigger } = useHaptics()

  const showQR = useChatShellStore(s => s.showQR)
  const setTeamSidebarOpen = useChatShellStore(s => s.setTeamSidebarOpen)

  return (
    <div className="border-border bg-header-bg text-header-text flex h-12 shrink-0 items-center justify-between border-b px-4">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="text-header-text md:hidden" />
        {room && <RoomSettings room={room} projects={projects} />}
        <span className="text-base font-bold">{roomName}</span>
      </div>
      <div className="flex items-center gap-3">
        {onCanvasClick && (
          <Tooltip>
            <TooltipTrigger
              aria-label="Canvas"
              className="text-header-text flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-lg hover:bg-white/10"
              onClick={() => {
                trigger('light')
                onCanvasClick?.()
              }}>
              <IconCanvas size={18} />
            </TooltipTrigger>
            <TooltipContent sideOffset={8}>Canvas</TooltipContent>
          </Tooltip>
        )}
        {onTerminalClick && (
          <Tooltip>
            <TooltipTrigger
              aria-label="Terminal viewer"
              className="text-header-text flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-lg hover:bg-white/10"
              onClick={() => {
                trigger('light')
                onTerminalClick?.()
              }}>
              <IconTerminal size={18} />
            </TooltipTrigger>
            <TooltipContent sideOffset={8}>Terminal viewer</TooltipContent>
          </Tooltip>
        )}
        {showInvite && (
          <Tooltip>
            <TooltipTrigger
              aria-label="QR code"
              className="text-header-text flex! cursor-pointer items-center justify-center gap-1.5 rounded-md border border-white/30 bg-transparent px-2.5 py-1 text-xs font-semibold whitespace-nowrap hover:bg-white/10"
              onClick={() => {
                trigger('light')
                showQR()
              }}>
              <IconQrcode size={18} />
            </TooltipTrigger>
            <TooltipContent sideOffset={8}>QR code</TooltipContent>
          </Tooltip>
        )}
        {showTeamToggle && (
          <Tooltip>
            <TooltipTrigger
              aria-label="Team members"
              className="text-header-text flex h-8 w-8 cursor-pointer items-center justify-center border-none bg-transparent text-lg min-[769px]:hidden"
              onClick={() => setTeamSidebarOpen(prev => !prev)}>
              <IconUsers size={18} />
            </TooltipTrigger>
            <TooltipContent sideOffset={8}>Team members</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  )
}
