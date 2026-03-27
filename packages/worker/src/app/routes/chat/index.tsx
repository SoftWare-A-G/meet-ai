import LobbyView from '@meet-ai/worker/app/components/LobbyView'
import { useRoomsQuery } from '@meet-ai/worker/app/hooks/useRoomsQuery'
import { roomsQueryOptions } from '@meet-ai/worker/app/lib/query-options'
import { createFileRoute } from '@tanstack/react-router'
import { useCallback } from 'react'
import type { Room } from '@meet-ai/worker/app/lib/types'

export const Route = createFileRoute('/chat/')({
  component: ChatLobby,
  loader: async ({ context: { queryClient } }) => {
    const rooms = await queryClient.ensureQueryData(roomsQueryOptions)
    return { rooms }
  },
})

function ChatLobby() {
  const { data: rooms = [] } = useRoomsQuery()
  const navigate = Route.useNavigate()

  const handleSelectRoom = useCallback(
    (room: Room) => {
      navigate({ to: '/chat/$id', params: { id: room.id } })
    },
    [navigate]
  )

  return (
    <div className="bg-chat-bg text-msg-text flex h-dvh min-w-0 flex-1 flex-col">
      <div className="border-border bg-header-bg text-header-text flex h-12 shrink-0 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <span className="text-base font-bold">Select a chat</span>
        </div>
      </div>
      <LobbyView rooms={rooms} onSelectRoom={handleSelectRoom} />
    </div>
  )
}
